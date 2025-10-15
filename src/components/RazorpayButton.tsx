import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RazorpayButtonProps {
  amount: number; // Amount in paise (e.g., 50000 for ₹500)
  planName: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  className?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RazorpayButton = ({ amount, planName, variant = 'default', className = '' }: RazorpayButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setIsLoading(true);
    
    try {
      // Create order via edge function
      const { data: order, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount,
          currency: 'INR',
          receipt: `receipt_${Date.now()}`,
        },
      });

      if (orderError) {
        throw new Error(orderError.message);
      }

      console.log('Order created:', order);

      // Initialize Razorpay checkout
      const options = {
        key: 'rzp_live_RTiCLa3AfusNB4',
        amount: order.amount,
        currency: order.currency,
        name: 'FlipFlow',
        description: `${planName} Plan`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const { data: verification, error: verifyError } = await supabase.functions.invoke(
              'verify-razorpay-payment',
              {
                body: {
                  order_id: response.razorpay_order_id,
                  payment_id: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                },
              }
            );

            if (verifyError) {
              throw new Error(verifyError.message);
            }

            if (verification.success) {
              toast({
                title: 'Payment Successful!',
                description: `Your ${planName} plan has been activated.`,
              });
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error: any) {
            console.error('Payment verification error:', error);
            toast({
              title: 'Payment Verification Failed',
              description: error.message || 'Please contact support.',
              variant: 'destructive',
            });
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#4F46E5',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (response: any) => {
        console.error('Payment failed:', response.error);
        toast({
          title: 'Payment Failed',
          description: response.error.description || 'Please try again.',
          variant: 'destructive',
        });
      });

      razorpay.open();
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading}
      variant={variant}
      className={className}
    >
      {isLoading ? 'Processing...' : 'Pay with Razorpay'}
    </Button>
  );
};

export default RazorpayButton;
