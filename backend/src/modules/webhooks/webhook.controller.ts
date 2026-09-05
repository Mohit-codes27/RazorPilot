import { NextFunction, Request, Response } from 'express';
import { verifyWebhookSignature } from '../../providers/payment/razorpay.provider.js';
import { InvalidWebhookSignatureError, ValidationError } from '../../utils/errors.js';
import { ok } from '../../utils/respond.js';
import { processRazorpayWebhook } from '../payments/payment.service.js';

/**
 * Razorpay webhook endpoint. No JWT — authenticity comes from the provider
 * HMAC signature over the raw request body. Always 200s validly-signed
 * events (even unknown types) so the provider stops retrying.
 */
export async function razorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.header('x-razorpay-signature');
    const rawBody = req.rawBody;
    if (!signature || !rawBody || !verifyWebhookSignature(rawBody, signature)) {
      throw new InvalidWebhookSignatureError();
    }

    const body = req.body as { id?: unknown; event?: unknown };
    if (typeof body.id !== 'string' || typeof body.event !== 'string') {
      throw new ValidationError('Invalid webhook payload');
    }

    const outcome = await processRazorpayWebhook(body.id, body.event, req.body);
    ok(res, { received: true, ...outcome });
  } catch (err) {
    next(err);
  }
}
