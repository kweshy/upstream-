import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { stkPush, callbackUrl } from './mpesa.server'

export const startMpesaPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { orderId: string; amount: number; phone: string; reference: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, total_kes, user_id')
      .eq('id', data.orderId)
      .eq('user_id', userId)
      .single()
    if (error || !order) throw new Error('Order not found')

    const { data: payment, error: paymentError } = await supabase.from('payments').insert({
      order_id: order.id,
      user_id: userId,
      purpose: 'order',
      method: 'mpesa_stk',
      amount: Number(order.total_kes),
      status: 'pending',
      phone_number: data.phone,
    }).select('id').single()
    if (paymentError || !payment) throw paymentError ?? new Error('Could not create payment record')

    try {
      const result = await stkPush({
        amount: Number(order.total_kes),
        phone: data.phone,
        reference: data.reference || order.order_number,
        description: `Upstream order ${order.order_number}`,
        callbackUrl: callbackUrl(),
      })
      await supabase.from('payments').update({
        checkout_request_id: result.checkoutRequestId,
        merchant_request_id: result.merchantRequestId,
      }).eq('id', payment.id)
      return result
    } catch (error) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      throw error
    }
  })
