import { formatPrice } from '@/lib/utils'

export interface OrderItemTemplate {
  title: string
  quantity: number
  price: number
  total: number
}

export interface OrderConfirmationEmailData {
  orderNumber: string
  createdAt: string
  email: string
  customerName?: string
  phone?: string
  shippingAddress?: string
  items: OrderItemTemplate[]
  subtotal: number
  shipping: number
  discount?: number
  couponDiscount?: number
  pointsUsed?: number
  total: number
  paymentLink: string
  qrImageUrl?: string // public URL to QR image
}

export function renderOrderConfirmationEmailHtml(d: OrderConfirmationEmailData): string {
  const discountLines: string[] = []
  if (d.discount && d.discount > 0) discountLines.push(`<tr><td style="padding:4px 0;color:#111">Discount</td><td style="text-align:right;color:#059669">-${formatPrice(d.discount)}</td></tr>`) 
  if (d.couponDiscount && d.couponDiscount > 0) discountLines.push(`<tr><td style="padding:4px 0;color:#111">Coupon</td><td style="text-align:right;color:#059669">-${formatPrice(d.couponDiscount)}</td></tr>`)
  if (d.pointsUsed && d.pointsUsed > 0) {
    const pointsValue = d.pointsUsed / 1000
    discountLines.push(`<tr><td style="padding:4px 0;color:#111">Points Used (${d.pointsUsed.toLocaleString()} pts)</td><td style="text-align:right;color:#059669">-$${pointsValue.toFixed(2)}</td></tr>`)
  }

  const itemsRows = d.items.map(it => `
    <tr>
      <td style="padding:8px 0;color:#111">${escapeHtml(it.title)} × ${it.quantity}</td>
      <td style="padding:8px 0;text-align:right;color:#111">${formatPrice(it.total)}</td>
    </tr>`).join('')

  const qrBlock = d.qrImageUrl ? `
    <div style="text-align:center;margin:16px 0">
      <a href="${d.paymentLink}" target="_blank" rel="noopener">
        <img src="${d.qrImageUrl}" alt="Payment QR Code" width="192" height="192" style="border:1px solid #e5e7eb;border-radius:8px"/>
      </a>
      <div style="font-size:12px;color:#475569;margin-top:8px">Scan with your banking app or click to open payment page</div>
    </div>
  ` : ''

  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Order Confirmation</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="padding:24px;border-bottom:1px solid #e2e8f0">
          <h1 style="margin:0;font-size:20px;color:#0f172a">Thank you for your purchase!</h1>
          <p style="margin:6px 0 0;color:#475569">Order ${escapeHtml(d.orderNumber)} • ${new Date(d.createdAt).toLocaleString()}</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 12px;color:#334155">We received your order. Please complete payment to process your order.</p>
          <div style="margin:12px 0;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px">
            <div style="font-weight:600;color:#1e3a8a;margin-bottom:8px">Payment Instructions</div>
            <div style="color:#1e3a8a;font-size:14px">Total Due: <strong>${formatPrice(d.total)}</strong></div>
            <div style="margin-top:8px">
              <a href="${d.paymentLink}" target="_blank" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">Pay Now</a>
            </div>
            ${qrBlock}
          </div>

          <div style="margin-top:16px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Items</div>
            <table style="width:100%;border-collapse:collapse">
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Summary</div>
            <table style="width:100%;border-collapse:collapse">
              <tbody>
                <tr><td style="padding:4px 0;color:#111">Subtotal</td><td style="text-align:right;color:#111">${formatPrice(d.subtotal)}</td></tr>
                <tr><td style="padding:4px 0;color:#111">Shipping</td><td style="text-align:right;color:#111">${d.shipping === 0 ? 'FREE' : formatPrice(d.shipping)}</td></tr>
                ${discountLines.join('')}
                <tr><td style="padding:8px 0;font-weight:700;color:#0f172a">Total</td><td style="text-align:right;font-weight:700;color:#0f172a">${formatPrice(d.total)}</td></tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Shipping To</div>
            <div style="font-size:14px;color:#111">${escapeHtml(d.customerName || 'Customer')}</div>
            <div style="font-size:14px;color:#334155">${escapeHtml(d.shippingAddress || '')}</div>
            ${d.phone ? `<div style="font-size:14px;color:#334155">Phone: ${escapeHtml(d.phone)}</div>` : ''}
          </div>

          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
            Need help? Contact support@foryoupiece.com
          </div>
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

