import crypto from 'node:crypto'
import midtransClient from 'midtrans-client'

const isSandbox = process.env.MIDTRANS_IS_SANDBOX !== 'false'

// Snap for frontend payment
export const snap = new midtransClient.Snap({
  isProduction: !isSandbox,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!
})

// Core API for backend operations (refund, etc)
export const coreApi = new midtransClient.CoreApi({
  isProduction: !isSandbox,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!
})

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY!
  
  const payload = orderId + statusCode + grossAmount + serverKey
  const calculatedSignature = crypto
    .createHash('sha512')
    .update(payload)
    .digest('hex')
  
  return calculatedSignature === signatureKey
}
