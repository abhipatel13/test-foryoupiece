export interface OrderCancelledEmailData {
  orderNumber: string
  createdAt: string
  email: string
  customerName?: string
  cancelReason?: string
}

export function renderOrderCancelledEmailHtml(d: OrderCancelledEmailData): string {
  const reason = d.cancelReason && d.cancelReason.trim().length > 0
    ? escapeHtml(d.cancelReason)
    : 'The order may be cancelled due to: Payment not received, Out of stock, Customer request, or Other.'

  return `
  <!doctype html>
  <html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Order Cancelled</title></head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="padding:24px;border-bottom:1px solid #e2e8f0">
          <h1 style="margin:0;font-size:20px;color:#0f172a">Your order has been cancelled</h1>
          <p style="margin:6px 0 0;color:#475569">Order ${escapeHtml(d.orderNumber)}</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 12px;color:#334155">We’re sorry to inform you that your order was cancelled.</p>
          <p style="margin:0 0 12px;color:#334155">Reason: ${reason}</p>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">If you have any questions, contact support@foryoupiece.com</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] as string))
}

