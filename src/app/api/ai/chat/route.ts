import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { AI_TOOLS_SCHEMA, executeAITool } from '@/lib/ai-tools';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

const SYSTEM_PROMPT = `You are "BayFlow AI Front Desk", an expert virtual service advisor and receptionist for modern auto workshops in Pakistan (Lahore, Karachi, Islamabad, Rawalpindi).
Your style:
- Courteous, professional, reassuring, and distinctly localized for Pakistani auto customers (polite Urdu greetings like "Assalam-o-Alaikum", "Jee bilkul", "Shukriya").
- Currency is always Pakistani Rupees (PKR / ₨).
- When a user asks about their vehicle, status, or estimate, ALWAYS use your tools:
  - 'find_customer' by name or phone
  - 'get_bookings' by plate, bookingNumber, or phone
  - 'get_estimate' by bookingNumber to retrieve exact itemized parts, labor, and grand total in PKR
- Clearly state the current status in plain customer-friendly language (e.g. "IN_REPAIR" means vehicle is on the mechanical bay undergoing repairs; "PARTS_READY" means parts are verified and repairs will begin shortly; "READY_FOR_PICKUP" means quality inspection passed and vehicle is ready).
- If the customer asks to speak to an advisor or has an urgent concern, acknowledge it and let them know a Service Advisor task has been logged for immediate callback.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, shopId, callerPhone, callerName } = body as {
      messages: Message[];
      shopId?: string;
      callerPhone?: string;
      callerName?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('INVALID_PAYLOAD', 'Messages array is required', 400);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

    // If OpenRouter API Key is configured, make real API call
    if (apiKey && apiKey.trim() !== '') {
      try {
        const fullMessages: Message[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ];

        const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://bayflow.pk',
            'X-Title': 'BayFlow Auto Operating System',
          },
          body: JSON.stringify({
            model,
            messages: fullMessages,
            tools: AI_TOOLS_SCHEMA,
            tool_choice: 'auto',
            temperature: 0.2,
          }),
        });

        if (openRouterRes.ok) {
          const completion = await openRouterRes.json();
          const choice = completion.choices?.[0];
          const responseMessage = choice?.message;

          // If the model requested tool calls, execute them and make 2nd hop
          if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolExecutions: any[] = [];
            const updatedMessages = [...fullMessages, responseMessage];

            for (const toolCall of responseMessage.tool_calls) {
              const name = toolCall.function.name;
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(toolCall.function.arguments);
              } catch {
                parsedArgs = {};
              }

              const result = await executeAITool(name, parsedArgs, shopId);
              toolExecutions.push({
                tool: name,
                args: parsedArgs,
                result,
              });

              updatedMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name,
                content: JSON.stringify(result),
              });
            }

            // Second hop with tool outputs
            const secondHopRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://bayflow.pk',
                'X-Title': 'BayFlow Auto Operating System',
              },
              body: JSON.stringify({
                model,
                messages: updatedMessages,
                temperature: 0.2,
              }),
            });

            if (secondHopRes.ok) {
              const secondCompletion = await secondHopRes.json();
              const finalMessage = secondCompletion.choices?.[0]?.message;
              return successResponse({
                message: finalMessage?.content || 'Understood, your request has been processed.',
                toolCalls: toolExecutions,
                provider: 'openrouter',
              });
            }
          }

          if (responseMessage?.content) {
            return successResponse({
              message: responseMessage.content,
              toolCalls: [],
              provider: 'openrouter',
            });
          }
        }
      } catch (err) {
        console.warn('OpenRouter call failed, falling back to local AI Front Desk agent:', err);
      }
    }

    // Local Deterministic AI Front Desk Engine (Zero External Dependencies fallback)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const text = lastUserMessage.toLowerCase();

    const toolExecutions: any[] = [];
    let assistantReply = '';

    // Entity detection
    const bookingMatch = lastUserMessage.match(/BF-\d{4}-\d{4}/i);
    const plateMatch = lastUserMessage.match(/[A-Z]{2,4}-\d{2}-\d{3,4}/i);
    const phoneMatch = lastUserMessage.match(/(?:\+92|0)?\s?3\d{2}[-\s]?\d{7}/);

    const bookingNumber = bookingMatch ? bookingMatch[0].toUpperCase() : undefined;
    const licensePlate = plateMatch ? plateMatch[0].toUpperCase() : undefined;
    const phone = phoneMatch ? phoneMatch[0] : callerPhone;

    if (text.includes('estimate') || text.includes('cost') || text.includes('price') || text.includes('bill') || text.includes('charges')) {
      // Execute get_estimate
      const estimateRes = await executeAITool('get_estimate', { bookingNumber: bookingNumber || 'BF-2026-1001' }, shopId);
      toolExecutions.push({ tool: 'get_estimate', args: { bookingNumber: bookingNumber || 'BF-2026-1001' }, result: estimateRes });

      if (estimateRes.found) {
        assistantReply = `Assalam-o-Alaikum! Jee bilkul, here are the estimate details for your **${estimateRes.vehicle}** (Plate: **${estimateRes.plate}**, Booking: **${estimateRes.bookingNumber}**):
• Revision: ${estimateRes.revision} (${estimateRes.status})
• Labor Total: ₨ ${estimateRes.laborTotalPKR.toLocaleString()}
• Parts Total: ₨ ${estimateRes.partsTotalPKR.toLocaleString()}
• **Grand Total:** ₨ ${estimateRes.grandTotalPKR.toLocaleString()}

The estimate includes ${estimateRes.lineItems.length} itemized repair items. You can review and approve it directly via your customer tracking link!`;
      } else {
        assistantReply = `Assalam-o-Alaikum! I searched for an active estimate for booking ${bookingNumber || 'provided'}. We could not find a submitted estimate yet. Our Service Advisor is currently compiling the diagnostics and will update it shortly.`;
      }
    } else if (text.includes('status') || text.includes('ready') || text.includes('update') || text.includes('where is') || text.includes('honda') || licensePlate || bookingNumber) {
      // Execute get_bookings
      const bookingRes = await executeAITool('get_bookings', {
        bookingNumber,
        licensePlate,
        phone,
        shopId,
      }, shopId);
      toolExecutions.push({ tool: 'get_bookings', args: { bookingNumber, licensePlate, phone }, result: bookingRes });

      if (bookingRes.found && bookingRes.bookings.length > 0) {
        const b = bookingRes.bookings[0];
        const statusDescriptions: Record<string, string> = {
          PENDING: 'Booking received, awaiting Service Advisor confirmation.',
          CONFIRMED: 'Confirmed! Slot reserved on the workshop calendar.',
          ASSIGNED: 'Master technician assigned to the job.',
          INSPECTING: 'Technician is performing multi-point vehicle inspection.',
          ESTIMATE_REVIEW: 'Inspection complete. Service advisor is reviewing the quotation.',
          AWAITING_CUSTOMER: 'Estimate sent! Awaiting your approval in customer portal.',
          ESTIMATE_APPROVED: 'Estimate approved! Parts procurement initiated.',
          ESTIMATE_REJECTED: 'Estimate declined. Service advisor revising requirements.',
          PARTS_PENDING: 'Inventory check in progress.',
          PARTS_ORDERED: 'Special parts ordered from supplier.',
          PARTS_READY: 'All parts verified in stock and allocated to vehicle.',
          IN_REPAIR: 'Vehicle is currently on the lift undergoing mechanical repair.',
          QC_PENDING: 'Repair work complete. Vehicle placed in Quality Inspection queue.',
          QC_IN_PROGRESS: 'Senior QC Inspector is road-testing and checking 30 safety points.',
          READY_FOR_PICKUP: 'Quality Inspection Passed! Your vehicle is ready for pickup.',
          COMPLETED: 'Vehicle handed over and job closed. Thank you for choosing us!',
          CANCELLED: 'Booking cancelled.',
        };

        const friendly = statusDescriptions[b.status] || b.status;
        assistantReply = `Assalam-o-Alaikum ${b.customerName}! Your vehicle **${b.vehicle}** (Booking: **${b.bookingNumber}**) at **${b.shopName}** is currently at status: **${b.status}**.
📌 **Current Stage:** ${friendly}
📅 Scheduled Date: ${new Date(b.scheduledDate).toLocaleDateString('en-GB')} (${b.scheduledSlot})
${b.latestEstimate ? `💰 Estimate Total: ₨ ${b.latestEstimate.totalPKR.toLocaleString()} (${b.latestEstimate.status})` : ''}

Is there anything specific you would like me to inform the Service Advisor?`;
      } else {
        assistantReply = `Assalam-o-Alaikum! I searched for bookings under ${licensePlate || phone || 'your details'}, but could not find an active record. Would you like me to connect you with our Lahore Central service desk?`;
      }
    } else if (text.includes('hello') || text.includes('hi') || text.includes('salam') || text.includes('aoa')) {
      assistantReply = `Assalam-o-Alaikum! Welcome to BayFlow Auto Front Desk. I am your virtual service assistant. How can I assist you today with your vehicle inspection, repair status, or parts estimate?`;
    } else {
      assistantReply = `Assalam-o-Alaikum! I have noted your message. You can ask me for real-time status of your car (e.g. "Check status of LEA-21-4892"), view your estimate breakdown in PKR, or leave a message for our workshop team. How can I help you?`;
    }

    return successResponse({
      message: assistantReply,
      toolCalls: toolExecutions,
      provider: 'local-engine',
    });
  } catch (error: any) {
    console.error('AI Front Desk error:', error);
    return errorResponse('AI_FRONT_DESK_ERROR', error.message || 'Error processing AI chat', 500);
  }
}
