-- -----------------------------------------------------------------------------
-- EXPANDED DEVELOPMENT SEED DATA
-- Fixed UUIDs are intentional so local reset + re-seed remains deterministic.
-- This file is for local/dev testing only.
-- -----------------------------------------------------------------------------
-- 1) BRANCHES
INSERT INTO
  branches (
    id,
    code,
    name,
    phone,
    alternate_phone,
    email,
    address,
    logo,
    banner,
    description,
    is_active
  )
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'MABD',
    'Mahabubabad Branch',
    '9000000001',
    '9000000002',
    'mabd@example.com',
    'Mahabubabad, Telangana',
    NULL,
    NULL,
    'Primary sample branch',
    true
  ),
  (
    '12121212-1212-4212-8212-121212121212',
    'HNMK',
    'Hanamkonda Branch',
    '9000000003',
    '9000000004',
    'hnmk@example.com',
    'Hanamkonda, Telangana',
    NULL,
    NULL,
    'Secondary sample branch',
    true
  );

-- 2) USERS
INSERT INTO
  users (
    id,
    full_name,
    phone,
    alternate_phone,
    email,
    avatar,
    address,
    role,
    branch_id,
    is_active
  )
VALUES
  (
    '22222222-2222-4222-8222-222222222222',
    'Admin User',
    '9000000010',
    NULL,
    'admin@example.com',
    NULL,
    'Mahabubabad, Telangana',
    'admin',
    '11111111-1111-4111-8111-111111111111',
    true
  ),
  (
    '23232323-2323-4232-8232-232323232323',
    'Operator User',
    '9000000011',
    NULL,
    'operator@example.com',
    NULL,
    'Mahabubabad, Telangana',
    'operator',
    '11111111-1111-4111-8111-111111111111',
    true
  ),
  (
    '24242424-2424-4242-8242-242424242424',
    'Manager User',
    '9000000012',
    NULL,
    'manager@example.com',
    NULL,
    'Mahabubabad, Telangana',
    'manager',
    '11111111-1111-4111-8111-111111111111',
    true
  ),
  (
    '25252525-2525-4252-8252-252525252525',
    'Staff User',
    '9000000013',
    NULL,
    'staff@example.com',
    NULL,
    'Mahabubabad, Telangana',
    'staff',
    '11111111-1111-4111-8111-111111111111',
    true
  ),
  (
    '26262626-2626-4262-8262-262626262626',
    'Hanamkonda Admin',
    '9000000014',
    NULL,
    'hnmk.admin@example.com',
    NULL,
    'Hanamkonda, Telangana',
    'admin',
    '12121212-1212-4212-8212-121212121212',
    true
  ),
  (
    '27272727-2727-4272-8272-272727272727',
    'Hanamkonda Operator',
    '9000000015',
    NULL,
    'hnmk.operator@example.com',
    NULL,
    'Hanamkonda, Telangana',
    'operator',
    '12121212-1212-4212-8212-121212121212',
    true
  );

-- 3) USER AUTH
-- Login credentials:
--   username: admin           password: admin123
--   username: operator        password: operator123
--   username: manager         password: manager123
--   username: staff           password: staff123
--   username: hnmkadmin       password: hnmkadmin123
--   username: hnmkoperator    password: hnmkoperator123
INSERT INTO
  user_auth (
    user_id,
    username,
    password_hash,
    failed_attempts,
    is_locked,
    last_login
  )
VALUES
  (
    '22222222-2222-4222-8222-222222222222',
    'admin',
    crypt ('admin123', gen_salt ('bf')),
    0,
    false,
    NULL
  ),
  (
    '23232323-2323-4232-8232-232323232323',
    'operator',
    crypt ('operator123', gen_salt ('bf')),
    0,
    false,
    NULL
  ),
  (
    '24242424-2424-4242-8242-242424242424',
    'manager',
    crypt ('manager123', gen_salt ('bf')),
    0,
    false,
    NULL
  ),
  (
    '25252525-2525-4252-8252-252525252525',
    'staff',
    crypt ('staff123', gen_salt ('bf')),
    0,
    false,
    NULL
  ),
  (
    '26262626-2626-4262-8262-262626262626',
    'hnmkadmin',
    crypt ('hnmkadmin123', gen_salt ('bf')),
    0,
    false,
    NULL
  ),
  (
    '27272727-2727-4272-8272-272727272727',
    'hnmkoperator',
    crypt ('hnmkoperator123', gen_salt ('bf')),
    0,
    false,
    NULL
  );

-- 4) CUSTOMERS
INSERT INTO
  customers (
    id,
    customer_numeric_id,
    customer_code,
    type,
    name,
    avatar,
    studio_name,
    phone,
    alternate_phone,
    address
  )
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    1001,
    'CUST-0001',
    'studio',
    'Test Customer',
    NULL,
    'Pixel Studio',
    '9000000020',
    NULL,
    'Warangal, Telangana'
  ),
  (
    '34343434-3434-4343-8343-343434343434',
    1002,
    'CUST-0002',
    'studio',
    'Ravi Photography',
    NULL,
    'Ravi Digital Studio',
    '9000000021',
    NULL,
    'Khammam, Telangana'
  ),
  (
    '35353535-3535-4353-8353-353535353535',
    1003,
    'CUST-0003',
    'amateur',
    'Sneha Reddy',
    NULL,
    NULL,
    '9000000022',
    NULL,
    'Hanamkonda, Telangana'
  ),
  (
    '36363636-3636-4363-8363-363636363636',
    1004,
    'CUST-0004',
    'other',
    'ABC Events',
    NULL,
    NULL,
    '9000000023',
    NULL,
    'Hyderabad, Telangana'
  ),
  (
    '37373737-3737-4373-8373-373737373737',
    1005,
    'CUST-0005',
    'employee',
    'Internal Staff Order',
    NULL,
    NULL,
    '9000000024',
    NULL,
    'Mahabubabad, Telangana'
  ),
  (
    '38383838-3838-4383-8383-383838383838',
    1006,
    'CUST-0006',
    'studio',
    'Focus Color Lab',
    NULL,
    'Focus Color Lab',
    '9000000025',
    NULL,
    'Karimnagar, Telangana'
  );

-- 5) VENDORS
INSERT INTO
  vendors (
    id,
    vendor_code,
    name,
    avatar,
    phone,
    alternate_phone,
    address
  )
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    'VEND-0001',
    'Sample Vendor',
    NULL,
    '9000000030',
    NULL,
    'Hyderabad, Telangana'
  ),
  (
    '45454545-4545-4454-8454-454545454545',
    'VEND-0002',
    'Paper World Supplies',
    NULL,
    '9000000031',
    NULL,
    'Secunderabad, Telangana'
  ),
  (
    '46464646-4646-4464-8464-464646464646',
    'VEND-0003',
    'PrintChem Distributors',
    NULL,
    '9000000032',
    NULL,
    'Warangal, Telangana'
  );

-- 6) INVENTORY
INSERT INTO
  inventory (
    id,
    branch_id,
    sku,
    name,
    image,
    unit,
    is_active,
    quantity,
    last_purchase_rate,
    last_vendor_id
  )
VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    'PHOTO-PRINT-4X6',
    'Photo Print 4x6',
    NULL,
    'piece',
    true,
    1000.000,
    8.50,
    '44444444-4444-4444-8444-444444444444'
  ),
  (
    '56565656-5656-4565-8565-565656565656',
    '11111111-1111-4111-8111-111111111111',
    'PHOTO-PRINT-5X7',
    'Photo Print 5x7',
    NULL,
    'piece',
    true,
    800.000,
    12.00,
    '44444444-4444-4444-8444-444444444444'
  ),
  (
    '57575757-5757-4575-8575-575757575757',
    '11111111-1111-4111-8111-111111111111',
    'LAM-SHEET-A4',
    'Lamination Sheet A4',
    NULL,
    'sheet',
    true,
    300.000,
    6.75,
    '45454545-4545-4454-8454-454545454545'
  ),
  (
    '58585858-5858-4585-8585-585858585858',
    '11111111-1111-4111-8111-111111111111',
    'MUG-PRINT',
    'Mug Print',
    NULL,
    'unit',
    true,
    120.000,
    85.00,
    '46464646-4646-4464-8464-464646464646'
  ),
  (
    '59595959-5959-4595-8595-595959595959',
    '12121212-1212-4212-8212-121212121212',
    'PHOTO-PRINT-4X6',
    'Photo Print 4x6',
    NULL,
    'piece',
    true,
    900.000,
    8.75,
    '44444444-4444-4444-8444-444444444444'
  ),
  (
    '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
    '12121212-1212-4212-8212-121212121212',
    'FRAME-12X18',
    'Photo Frame 12x18',
    NULL,
    'unit',
    true,
    75.000,
    140.00,
    '45454545-4545-4454-8454-454545454545'
  ),
  (
    '5b5b5b5b-5b5b-45b5-85b5-5b5b5b5b5b5b',
    '12121212-1212-4212-8212-121212121212',
    'CANVAS-16X20',
    'Canvas Print 16x20',
    NULL,
    'unit',
    true,
    40.000,
    280.00,
    '46464646-4646-4464-8464-464646464646'
  );

-- 7) INVENTORY PRICING
INSERT INTO
  inventory_pricing (
    id,
    branch_id,
    inventory_id,
    customer_type,
    selling_rate,
    effective_from,
    effective_to
  )
VALUES
  (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'studio',
    10.00,
    DATE '2026-04-01',
    NULL
  ),
  (
    '67676767-6767-4676-8676-676767676767',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'amateur',
    12.00,
    DATE '2026-04-01',
    NULL
  ),
  (
    '68686868-6868-4686-8686-686868686868',
    '11111111-1111-4111-8111-111111111111',
    '56565656-5656-4565-8565-565656565656',
    'studio',
    16.00,
    DATE '2026-04-01',
    NULL
  ),
  (
    '69696969-6969-4696-8696-696969696969',
    '11111111-1111-4111-8111-111111111111',
    '57575757-5757-4575-8575-575757575757',
    'other',
    10.50,
    DATE '2026-04-01',
    NULL
  ),
  (
    '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a',
    '11111111-1111-4111-8111-111111111111',
    '58585858-5858-4585-8585-585858585858',
    'studio',
    125.00,
    DATE '2026-04-01',
    NULL
  ),
  (
    '6b6b6b6b-6b6b-46b6-86b6-6b6b6b6b6b6b',
    '12121212-1212-4212-8212-121212121212',
    '59595959-5959-4595-8595-595959595959',
    'studio',
    10.50,
    DATE '2026-04-01',
    NULL
  ),
  (
    '6c6c6c6c-6c6c-46c6-86c6-6c6c6c6c6c6c',
    '12121212-1212-4212-8212-121212121212',
    '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
    'other',
    220.00,
    DATE '2026-04-01',
    NULL
  ),
  (
    '6d6d6d6d-6d6d-46d6-86d6-6d6d6d6d6d6d',
    '12121212-1212-4212-8212-121212121212',
    '5b5b5b5b-5b5b-45b5-85b5-5b5b5b5b5b5b',
    'studio',
    420.00,
    DATE '2026-04-01',
    NULL
  );

-- 8) ORDERS
-- order_code is generated by the database from branch + order_date year + sequence
INSERT INTO
  orders (
    id,
    branch_id,
    created_by,
    customer_id,
    status,
    discount_amount,
    order_date
  )
VALUES
  (
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'pending',
    0.00,
    TIMESTAMPTZ '2026-04-07 10:00:00+00'
  ),
  (
    '78787878-7878-4787-8787-787878787878',
    '11111111-1111-4111-8111-111111111111',
    '23232323-2323-4232-8232-232323232323',
    '34343434-3434-4343-8343-343434343434',
    'processing',
    20.00,
    TIMESTAMPTZ '2026-04-08 09:30:00+00'
  ),
  (
    '79797979-7979-4797-8797-797979797979',
    '11111111-1111-4111-8111-111111111111',
    '24242424-2424-4242-8242-242424242424',
    '35353535-3535-4353-8353-353535353535',
    'completed',
    0.00,
    TIMESTAMPTZ '2026-04-08 12:00:00+00'
  ),
  (
    '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
    '11111111-1111-4111-8111-111111111111',
    '25252525-2525-4252-8252-252525252525',
    '36363636-3636-4363-8363-363636363636',
    'delivered',
    15.00,
    TIMESTAMPTZ '2026-04-09 08:15:00+00'
  ),
  (
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    '12121212-1212-4212-8212-121212121212',
    '26262626-2626-4262-8262-262626262626',
    '38383838-3838-4383-8383-383838383838',
    'pending',
    0.00,
    TIMESTAMPTZ '2026-04-09 10:45:00+00'
  ),
  (
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '12121212-1212-4212-8212-121212121212',
    '27272727-2727-4272-8272-272727272727',
    '35353535-3535-4353-8353-353535353535',
    'processing',
    25.00,
    TIMESTAMPTZ '2026-04-09 14:00:00+00'
  ),
  (
    '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
    '12121212-1212-4212-8212-121212121212',
    '26262626-2626-4262-8262-262626262626',
    '34343434-3434-4343-8343-343434343434',
    'completed',
    0.00,
    TIMESTAMPTZ '2026-04-10 09:00:00+00'
  ),
  (
    '7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e7e',
    '11111111-1111-4111-8111-111111111111',
    '23232323-2323-4232-8232-232323232323',
    '37373737-3737-4373-8373-373737373737',
    'pending',
    5.00,
    TIMESTAMPTZ '2026-04-10 11:30:00+00'
  );

-- 9) ORDER ITEMS
-- These automatically deduct inventory and recalculate order totals
INSERT INTO
  order_items (
    id,
    order_id,
    inventory_id,
    quantity,
    unit_price,
    line_total
  )
VALUES
  (
    '88888888-8888-4888-8888-888888888888',
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555',
    10.000,
    10.00,
    100.00
  ),
  (
    '89898989-8989-4898-8898-898989898989',
    '77777777-7777-4777-8777-777777777777',
    '56565656-5656-4565-8565-565656565656',
    4.000,
    16.00,
    64.00
  ),
  (
    '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a',
    '78787878-7878-4787-8787-787878787878',
    '55555555-5555-4555-8555-555555555555',
    20.000,
    10.00,
    200.00
  ),
  (
    '8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b',
    '78787878-7878-4787-8787-787878787878',
    '57575757-5757-4575-8575-575757575757',
    5.000,
    10.50,
    52.50
  ),
  (
    '8c8c8c8c-8c8c-48c8-88c8-8c8c8c8c8c8c',
    '79797979-7979-4797-8797-797979797979',
    '58585858-5858-4585-8585-585858585858',
    2.000,
    125.00,
    250.00
  ),
  (
    '8d8d8d8d-8d8d-48d8-88d8-8d8d8d8d8d8d',
    '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
    '56565656-5656-4565-8565-565656565656',
    8.000,
    16.00,
    128.00
  ),
  (
    '8e8e8e8e-8e8e-48e8-88e8-8e8e8e8e8e8e',
    '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
    '57575757-5757-4575-8575-575757575757',
    3.000,
    10.50,
    31.50
  ),
  (
    '8f8f8f8f-8f8f-48f8-88f8-8f8f8f8f8f8f',
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    '59595959-5959-4595-8595-595959595959',
    25.000,
    10.50,
    262.50
  ),
  (
    '90909090-9090-4909-8909-909090909090',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a',
    2.000,
    220.00,
    440.00
  ),
  (
    '91919191-9191-4919-8919-919191919191',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '5b5b5b5b-5b5b-45b5-85b5-5b5b5b5b5b5b',
    1.000,
    420.00,
    420.00
  ),
  (
    '92929292-9292-4929-8929-929292929292',
    '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
    '59595959-5959-4595-8595-595959595959',
    12.000,
    10.50,
    126.00
  ),
  (
    '93939393-9393-4939-8939-939393939393',
    '7e7e7e7e-7e7e-47e7-87e7-7e7e7e7e7e7e',
    '55555555-5555-4555-8555-555555555555',
    6.000,
    12.00,
    72.00
  );

-- 10) PAYMENTS
-- These automatically recalculate paid_amount and payment_status
INSERT INTO
  payments (
    id,
    order_id,
    branch_id,
    received_by,
    amount,
    mode,
    txn_reference
  )
VALUES
  (
    '99999999-9999-4999-8999-999999999999',
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    50.00,
    'cash',
    'TXN-SAMPLE-0001'
  ),
  (
    '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a',
    '78787878-7878-4787-8787-787878787878',
    '11111111-1111-4111-8111-111111111111',
    '23232323-2323-4232-8232-232323232323',
    100.00,
    'upi',
    'TXN-MABD-0002'
  ),
  (
    '9b9b9b9b-9b9b-49b9-89b9-9b9b9a9a9b9b',
    '78787878-7878-4787-8787-787878787878',
    '11111111-1111-4111-8111-111111111111',
    '24242424-2424-4242-8242-242424242424',
    132.50,
    'cash',
    'TXN-MABD-0003'
  ),
  (
    '9c9c9c9c-9c9c-49c9-89c9-9c9c9c9c9c9c',
    '79797979-7979-4797-8797-797979797979',
    '11111111-1111-4111-8111-111111111111',
    '24242424-2424-4242-8242-242424242424',
    250.00,
    'card',
    'TXN-MABD-0004'
  ),
  (
    '9d9d9d9d-9d9d-49d9-89d9-9d9d9d9d9d9d',
    '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
    '11111111-1111-4111-8111-111111111111',
    '25252525-2525-4252-8252-252525252525',
    80.00,
    'cash',
    'TXN-MABD-0005'
  ),
  (
    '9e9e9e9e-9e9e-49e9-89e9-9e9e9e9e9e9e',
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    '12121212-1212-4212-8212-121212121212',
    '26262626-2626-4262-8262-262626262626',
    100.00,
    'upi',
    'TXN-HNMK-0001'
  ),
  (
    '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f9f',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '12121212-1212-4212-8212-121212121212',
    '27272727-2727-4272-8272-272727272727',
    500.00,
    'card',
    'TXN-HNMK-0002'
  ),
  (
    'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '12121212-1212-4212-8212-121212121212',
    '26262626-2626-4262-8262-262626262626',
    335.00,
    'cash',
    'TXN-HNMK-0003'
  ),
  (
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    '7d7d7d7d-7d7d-47d7-87d7-7d7d7d7d7d7d',
    '12121212-1212-4212-8212-121212121212',
    '26262626-2626-4262-8262-262626262626',
    126.00,
    'cash',
    'TXN-HNMK-0004'
  );

-- 11) ORDER VENDORS
INSERT INTO
  order_vendors (id, order_id, vendor_id, vendor_paid_amount)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444',
    20.00
  ),
  (
    'abababab-abab-4aba-8aba-abababababab',
    '78787878-7878-4787-8787-787878787878',
    '45454545-4545-4454-8454-454545454545',
    35.00
  ),
  (
    'acacacac-acac-4aca-8aca-acacacacacac',
    '79797979-7979-4797-8797-797979797979',
    '46464646-4646-4464-8464-464646464646',
    60.00
  ),
  (
    'adadadad-adad-4ada-8ada-adadadadadad',
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    '44444444-4444-4444-8444-444444444444',
    25.00
  ),
  (
    'aeaeaeae-aeae-4aea-8aea-aeaeaeaeaeae',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    '46464646-4646-4464-8464-464646464646',
    95.00
  );

-- 12) OFFER ITEMS
INSERT INTO
  offer_items (
    id,
    branch_id,
    item_name,
    item_image,
    quantity_in_stock,
    total_ordered_qty,
    is_active
  )
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111',
    'Keychain Gift',
    NULL,
    25,
    0,
    true
  ),
  (
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
    '11111111-1111-4111-8111-111111111111',
    'Mini Photo Frame',
    NULL,
    18,
    0,
    true
  ),
  (
    'bdbdbdbd-bdbd-4bdb-8bdb-bdbdbdbdbdbd',
    '12121212-1212-4212-8212-121212121212',
    'Fridge Magnet',
    NULL,
    30,
    0,
    true
  ),
  (
    'bebebebe-bebe-4beb-8beb-bebebebebebe',
    '12121212-1212-4212-8212-121212121212',
    'Table Calendar',
    NULL,
    15,
    0,
    true
  );

-- 13) ORDER OFFER ITEMS
-- These automatically reduce offer item stock and update ordered count
INSERT INTO
  order_offer_items (id, order_id, offer_item_id, qty)
VALUES
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '77777777-7777-4777-8777-777777777777',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    2
  ),
  (
    'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
    '78787878-7878-4787-8787-787878787878',
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
    1
  ),
  (
    'cececece-cece-4ece-8ece-cececececece',
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    'bdbdbdbd-bdbd-4bdb-8bdb-bdbdbdbdbdbd',
    3
  ),
  (
    'cfcfcfcf-cfcf-4fcf-8fcf-cfcfcfcfcfcf',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    'bebebebe-bebe-4beb-8beb-bebebebebebe',
    2
  );

-- 14) EXPENSE CATEGORIES
INSERT INTO
  expense_categories (
    id,
    code,
    name,
    description,
    scope,
    is_active,
    is_system,
    sort_order
  )
VALUES
  (
    'f1111111-1111-4111-8111-111111111111',
    'vendor_payment',
    'Vendor Payment',
    'Payments made to vendors for branch operations.',
    'branch',
    true,
    true,
    10
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'electricity',
    'Electricity',
    'Branch electricity and utility payments.',
    'branch',
    true,
    true,
    20
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    'maintenance',
    'Maintenance',
    'Maintenance and repair costs for branch equipment and facilities.',
    'branch',
    true,
    true,
    30
  ),
  (
    'f4444444-4444-4444-8444-444444444444',
    'rent',
    'Rent',
    'Branch rent and lease payments.',
    'branch',
    true,
    true,
    40
  ),
  (
    'f5555555-5555-4555-8555-555555555555',
    'internet',
    'Internet',
    'Internet and connectivity expenses.',
    'branch',
    true,
    true,
    50
  ),
  (
    'f6666666-6666-4666-8666-666666666666',
    'stationery',
    'Stationery',
    'Office and printing stationery expenses.',
    'branch',
    true,
    true,
    60
  ),
  (
    'f7777777-7777-4777-8777-777777777777',
    'logistics',
    'Logistics',
    'Shared shipping, packing, courier, and transport support expenses.',
    'both',
    true,
    true,
    70
  ),
  (
    'f8888888-8888-4888-8888-888888888888',
    'travel',
    'Travel',
    'Employee travel and local transit expenses.',
    'employee',
    true,
    true,
    80
  ),
  (
    'f9999999-9999-4999-8999-999999999999',
    'food',
    'Food',
    'Employee meals and refreshments.',
    'employee',
    true,
    true,
    90
  ),
  (
    'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'fuel',
    'Fuel',
    'Employee fuel and vehicle running costs.',
    'employee',
    true,
    true,
    100
  ),
  (
    'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'misc',
    'Miscellaneous',
    'Other uncategorized business or employee expenses.',
    'both',
    true,
    true,
    110
  )
ON CONFLICT DO NOTHING;

-- 15) BRANCH EXPENSES
INSERT INTO
  branch_expenses (
    id,
    branch_id,
    title,
    amount,
    category_id,
    expense_date,
    remarks,
    payment_mode,
    order_vendor_id,
    created_by,
    updated_by
  )
VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '11111111-1111-4111-8111-111111111111',
    'Vendor Settlement',
    20.00,
    'f1111111-1111-4111-8111-111111111111',
    DATE '2026-04-07',
    'Sample branch expense linked to vendor',
    'cash',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222'
  ),
  (
    'dededede-dede-4ede-8ede-dededededede',
    '11111111-1111-4111-8111-111111111111',
    'Paper Purchase Settlement',
    35.00,
    'f1111111-1111-4111-8111-111111111111',
    DATE '2026-04-08',
    'Settlement against order vendor mapping',
    'upi',
    'abababab-abab-4aba-8aba-abababababab',
    '23232323-2323-4232-8232-232323232323',
    '23232323-2323-4232-8232-232323232323'
  ),
  (
    'dfdfdfdf-dfdf-4fdf-8fdf-dfdfdfdfdfdf',
    '11111111-1111-4111-8111-111111111111',
    'Electricity Bill',
    120.00,
    'f2222222-2222-4222-8222-222222222222',
    DATE '2026-04-10',
    'April branch electricity bill',
    'cash',
    NULL,
    '24242424-2424-4242-8242-242424242424',
    '24242424-2424-4242-8242-242424242424'
  ),
  (
    'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
    '12121212-1212-4212-8212-121212121212',
    'Canvas Vendor Settlement',
    95.00,
    'f1111111-1111-4111-8111-111111111111',
    DATE '2026-04-09',
    'Linked settlement for Hanamkonda order',
    'card',
    'aeaeaeae-aeae-4aea-8aea-aeaeaeaeaeae',
    '27272727-2727-4272-8272-272727272727',
    '27272727-2727-4272-8272-272727272727'
  ),
  (
    'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
    '12121212-1212-4212-8212-121212121212',
    'Printer Maintenance',
    80.00,
    'f3333333-3333-4333-8333-333333333333',
    DATE '2026-04-10',
    'Routine machine service',
    'cash',
    NULL,
    '26262626-2626-4262-8262-262626262626',
    '26262626-2626-4262-8262-262626262626'
  );

-- 16) EMPLOYEE EXPENSES
INSERT INTO
  employee_expenses (
    id,
    user_id,
    branch_id,
    title,
    amount,
    category_id,
    order_id,
    expense_date,
    payment_mode,
    remarks,
    created_by,
    updated_by
  )
VALUES
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '23232323-2323-4232-8232-232323232323',
    '11111111-1111-4111-8111-111111111111',
    'Local Delivery Travel',
    15.00,
    'f8888888-8888-4888-8888-888888888888',
    '77777777-7777-4777-8777-777777777777',
    DATE '2026-04-07',
    'cash',
    'Local delivery travel expense',
    '23232323-2323-4232-8232-232323232323',
    '23232323-2323-4232-8232-232323232323'
  ),
  (
    'efefefef-efef-4fef-8fef-efefefefefef',
    '25252525-2525-4252-8252-252525252525',
    '11111111-1111-4111-8111-111111111111',
    'Packaging and Courier Handoff',
    40.00,
    'f7777777-7777-4777-8777-777777777777',
    '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a',
    DATE '2026-04-09',
    'cash',
    'Packaging and courier handoff expense',
    '25252525-2525-4252-8252-252525252525',
    '25252525-2525-4252-8252-252525252525'
  ),
  (
    'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0',
    '27272727-2727-4272-8272-272727272727',
    '12121212-1212-4212-8212-121212121212',
    'Pickup and Delivery',
    22.00,
    'f8888888-8888-4888-8888-888888888888',
    '7b7b7b7b-7b7b-47b7-87b7-7b7b7b7b7b7b',
    DATE '2026-04-09',
    'upi',
    'Pickup and delivery expense',
    '27272727-2727-4272-8272-272727272727',
    '27272727-2727-4272-8272-272727272727'
  ),
  (
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    '26262626-2626-4262-8262-262626262626',
    '12121212-1212-4212-8212-121212121212',
    'Client Visit',
    55.00,
    'f8888888-8888-4888-8888-888888888888',
    '7c7c7c7c-7c7c-47c7-87c7-7c7c7c7c7c7c',
    DATE '2026-04-09',
    'cash',
    'On-site customer discussion and sample delivery',
    '26262626-2626-4262-8262-262626262626',
    '26262626-2626-4262-8262-262626262626'
  );

-- 17) OPTIONAL TEST CASE: CANCELLED ORDER FLOW
-- Create a cancellable order, add items, then cancel it so inventory restoration trigger is exercised.
INSERT INTO
  orders (
    id,
    branch_id,
    created_by,
    customer_id,
    status,
    discount_amount,
    order_date
  )
VALUES
  (
    '88888888-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '38383838-3838-4383-8383-383838383838',
    'pending',
    0.00,
    TIMESTAMPTZ '2026-04-10 15:00:00+00'
  );

INSERT INTO
  order_items (
    id,
    order_id,
    inventory_id,
    quantity,
    unit_price,
    line_total
  )
VALUES
  (
    '94949494-9494-4949-8949-949494949494',
    '88888888-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    5.000,
    10.00,
    50.00
  );

UPDATE orders
SET
  status = 'cancelled'
WHERE
  id = '88888888-1111-4111-8111-111111111111';
