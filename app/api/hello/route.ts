import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'Halo dari API Route Next.js (Fullstack)!' });
}
