import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/mpesa/callback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json()
          const callback = payload?.Body?.stkCallback
          const checkoutRequestId = callback?.CheckoutRequestID
          if (!checkoutRequestId) return Response.json({ ResultCode: 1, ResultDesc: 'Missing CheckoutRequestID' }, { status: 400 })

          const url = process.env['SUPABASE_URL']
          const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
          if (!url || !serviceKey) return Response.json({ ResultCode: 1, ResultDesc: 'Server payment configuration missing' }, { status: 500 })

          const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
          const resultCode = Number(callback?.ResultCode ?? 1)
          const metadata = callback?.CallbackMetadata?.Item ?? []
          const getMeta = (name: string) => metadata.find((item: { Name?: string }) => item.Name === name)?.Value
          const receipt = getMeta('MpesaReceiptNumber')

          const { data: payment } = await supabase
            .from('payments')
            .select('id, order_id, status')
            .eq('checkout_request_id', checkoutRequestId)
            .maybeSingle()

          if (!payment) return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' })

          if (resultCode === 0) {
            await supabase.from('payments').update({
              status: 'success',
              mpesa_receipt: receipt ? String(receipt) : null,
              confirmed_at: new Date().toISOString(),
            }).eq('id', payment.id)
            if (payment.order_id) {
              await supabase.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', payment.order_id)
            }
          } else {
            await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
          }
          return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' })
        } catch (error) {
          console.error('M-Pesa callback error', error)
          return Response.json({ ResultCode: 1, ResultDesc: 'Callback processing failed' }, { status: 500 })
        }
      },
    },
  },
})
