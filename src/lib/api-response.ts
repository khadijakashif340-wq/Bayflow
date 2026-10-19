import { NextResponse } from 'next/server';

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
    },
    { status }
  );
}

export const successResponse = apiSuccess;
export const errorResponse = apiError;

