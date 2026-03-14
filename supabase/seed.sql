-- Seed data for Hotel Reservation System
-- Run this in Supabase SQL Editor after running setup.sql

-- Insert sample rooms
INSERT INTO rooms (name, description, base_price, image_url) VALUES
('Deluxe Room', 'Spacious room with city view, king-size bed, and modern amenities. Perfect for business travelers.', 850000, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'),
('Superior Room', 'Comfortable room with garden view, queen-size bed, and workspace. Ideal for couples.', 650000, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'),
('Standard Room', 'Cozy room with all essential amenities for a pleasant stay. Great value for money.', 450000, 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800'),
('Suite Room', 'Luxurious suite with separate living area, premium amenities, and stunning ocean view.', 1500000, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800'),
('Family Room', 'Spacious room with two queen beds, perfect for families. Includes kids amenities.', 1200000, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800');

-- Insert dynamic room rates for the next 30 days (weekend rates higher)
DO $$
DECLARE
    room_record RECORD;
    current_date_val DATE := CURRENT_DATE;
    end_date_val DATE := CURRENT_DATE + 30;
    day_of_week_val INTEGER;
    price_val INTEGER;
BEGIN
    FOR room_record IN SELECT id, base_price FROM rooms LOOP
        current_date_val := CURRENT_DATE;
        
        WHILE current_date_val <= end_date_val LOOP
            day_of_week_val := EXTRACT(DOW FROM current_date_val);
            
            -- Weekend rates (Friday, Saturday, Sunday) - 20% higher
            IF day_of_week_val IN (0, 5, 6) THEN
                price_val := room_record.base_price * 1.2;
            ELSE
                price_val := room_record.base_price;
            END IF;
            
            INSERT INTO room_rates (room_id, rate_date, price)
            VALUES (room_record.id, current_date_val, price_val)
            ON CONFLICT (room_id, rate_date) DO NOTHING;
            
            current_date_val := current_date_val + 1;
        END LOOP;
    END LOOP;
END $$;