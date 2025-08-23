import { formatPrice } from '@/lib/utils'

export interface OrderItemTemplate {
  title: string
  quantity: number
  price: number
  total: number
}

export interface OrderShippedEmailData {
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
  trackingNumber?: string
  trackingUrl?: string
}

export function renderOrderShippedEmailHtml(d: OrderShippedEmailData): string {
  // Build items rows
  const itemsRows = d.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9">
        <div style="font-weight:600;color:#0f172a">${escapeHtml(item.title)}</div>
        <div style="font-size:14px;color:#64748b">Qty: ${item.quantity}</div>
      </td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f1f5f9;color:#0f172a">${formatPrice(item.total)}</td>
    </tr>
  `).join('')

  // Build discount lines
  const discountLines = []
  if (d.discount && d.discount > 0) {
    discountLines.push(`<tr><td style="padding:4px 0;color:#111">Discount</td><td style="text-align:right;color:#059669">-${formatPrice(d.discount)}</td></tr>`)
  }
  if (d.couponDiscount && d.couponDiscount > 0) {
    discountLines.push(`<tr><td style="padding:4px 0;color:#111">Coupon Discount</td><td style="text-align:right;color:#059669">-${formatPrice(d.couponDiscount)}</td></tr>`)
  }
  if (d.pointsUsed && d.pointsUsed > 0) {
    discountLines.push(`<tr><td style="padding:4px 0;color:#111">Points Used</td><td style="text-align:right;color:#059669">-${formatPrice(d.pointsUsed / 1000)}</td></tr>`)
  }

  // Build tracking section
  const trackingSection = d.trackingUrl || d.trackingNumber ? `
    <div style="margin:12px 0;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
      <div style="font-weight:600;color:#166534;margin-bottom:8px">📦 Tracking Information</div>
      ${d.trackingUrl
        ? `<div style="color:#166534;font-size:14px;margin-bottom:8px">
             <a href="${d.trackingUrl}" target="_blank" style="color:#166534;text-decoration:underline">Track your shipment online</a>
           </div>`
        : ''
      }
      ${d.trackingNumber
        ? `<div style="color:#166534;font-size:14px">Tracking Number: <strong>${escapeHtml(d.trackingNumber)}</strong></div>`
        : ''
      }
      <div style="color:#166534;font-size:14px;margin-top:8px">
        <strong>Estimated Delivery:</strong> 1-2 business days
      </div>
    </div>
  ` : `
    <div style="margin:12px 0;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
      <div style="font-weight:600;color:#166534;margin-bottom:8px">📦 Shipping Information</div>
      <div style="color:#166534;font-size:14px">Your order has been shipped and is on its way!</div>
      <div style="color:#166534;font-size:14px;margin-top:4px">
        <strong>Estimated Delivery:</strong> 1-2 business days
      </div>
      <div style="color:#166534;font-size:14px;margin-top:4px">
        Tracking information will be provided shortly.
      </div>
    </div>
  `

  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Order Shipped</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="padding:24px;border-bottom:1px solid #e2e8f0">
          <h1 style="margin:0;font-size:20px;color:#0f172a">🚚 Your order is on the way!</h1>
          <p style="margin:6px 0 0;color:#475569">Order ${escapeHtml(d.orderNumber)} • Shipped on ${new Date(d.createdAt).toLocaleDateString()}</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 12px;color:#334155">Great news! Your order has been shipped and will arrive within <strong>1-2 business days</strong>.</p>

          ${trackingSection}

          <div style="margin-top:16px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Items Shipped</div>
            <table style="width:100%;border-collapse:collapse">
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:8px">Order Summary</div>
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

