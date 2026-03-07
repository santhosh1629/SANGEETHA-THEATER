-- SQL Updates for Order Management Workflow

-- 1. Ensure all required columns exist in the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_by UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by_staff_id UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by_staff_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- 2. Update existing orders to have consistent status if needed (Optional)
-- UPDATE orders SET status = 'QR Generated' WHERE status = 'Initiated' AND payment_status = 'paid';

-- 3. Add indexes for performance (Optional but recommended)
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_prepared_by ON orders(prepared_by);
