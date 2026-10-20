-- Fermier Agency demo seed. ALL records here are SAMPLE DATA for demonstration only.
-- Prices, stock levels and customers are fictional. No real GSTINs or registration numbers.

insert into company_settings (company_name, legal_name, address, phone, email, whatsapp_number, default_terms)
values ('Fermier Agency', 'Fermier Agency (Sample)', 'Sample address — update in Settings', '+91 00000 00000',
        'sales@example.com', '910000000000',
        E'1. Prices are ex-warehouse unless stated otherwise.\n2. GST extra as applicable.\n3. Delivery subject to stock availability at the time of order confirmation.\n4. Warranty as per manufacturer terms.\n5. This quotation is valid until the expiry date shown above.');

insert into warehouses (code, name, address, is_default) values ('MAIN', 'Main Warehouse', 'Sample warehouse address', true);

insert into integration_connections (provider, mode, region) values ('zoho_books', 'mock', 'in');

insert into permissions (key, description) values
 ('products.manage','Create and edit products, categories and brands'),
 ('products.view_cost','View purchase cost and stock valuation'),
 ('inventory.manage','Record stock movements and dispatches'),
 ('customers.manage','Create and edit customers'),
 ('quotations.create','Create and edit quotations'),
 ('quotations.approve','Approve quotations above discount/amount thresholds'),
 ('orders.confirm','Verify POs and confirm sales orders'),
 ('integrations.manage','Configure Zoho Books and email'),
 ('users.manage','Manage users and roles'),
 ('audit.view','View audit logs'),
 ('reports.financial','View financial reports');

insert into role_permissions (role, permission) select 'super_admin', key from permissions;
insert into role_permissions (role, permission) values
 ('admin','products.manage'),('admin','products.view_cost'),('admin','inventory.manage'),('admin','customers.manage'),
 ('admin','quotations.create'),('admin','quotations.approve'),('admin','orders.confirm'),('admin','reports.financial'),
 ('sales_manager','customers.manage'),('sales_manager','quotations.create'),('sales_manager','quotations.approve'),
 ('sales_manager','orders.confirm'),('sales_manager','reports.financial'),
 ('sales_executive','quotations.create'),
 ('inventory_manager','inventory.manage'),('inventory_manager','products.view_cost');

insert into categories (name, slug, description, sort_order) values
 ('Construction Equipment','construction-equipment','Winches, mixers, compactors and site machinery',1),
 ('Lifting Equipment','lifting-equipment','Hoists, winches and lifting accessories',2),
 ('Material Handling Equipment','material-handling-equipment','Pallet trucks, stackers and trolleys',3),
 ('Generators','generators','Portable and standby generators',4),
 ('Car Washers & Vacuum Cleaners','car-washers-vacuum-cleaners','Car wash equipment and wet & dry vacuums',5),
 ('Agriculture & Garden Equipment','agriculture-garden-equipment','Power weeders, brush cutters and sprayers',6),
 ('Air Compressors','air-compressors','Piston and portable air compressors',7),
 ('Fogging Machines','fogging-machines','Thermal and ULV foggers',8),
 ('Pressure Washers','pressure-washers','High-pressure cleaning machines',9),
 ('Mini Cranes','mini-cranes','Mini crane frames and rooftop cranes',10),
 ('Welding Equipment','welding-equipment','Inverter welding machines and accessories',11),
 ('Power Tools','power-tools','Drills, grinders, breakers and cutters',12);

insert into brands (name, slug) values
 ('Y-tal','y-tal'),('Fermier Pro','fermier-pro'),('PowerMax','powermax'),('AgriKing','agriking'),('AirTech','airtech');

-- Products
with c as (select slug, id from categories), b as (select slug, id from brands)
insert into products (sku, slug, name, brand_id, manufacturer, category_id, model_number, short_description, description,
  unit, selling_price, purchase_cost, tax_rate, hsn_code, price_visibility, reorder_threshold, is_featured, status, is_sample_data)
select v.sku, v.slug, v.name, (select id from b where b.slug = v.brand), v.mfr, (select id from c where c.slug = v.cat),
  v.model, v.short_d, v.long_d, v.unit, v.price, v.cost, v.tax, v.hsn, v.vis::price_visibility, v.reorder, v.featured,
  'active', true
from (values
 ('YT-WN-500E','y-tal-500kg-winch-eco','Y-tal 500 kg Winch — Eco Model','y-tal','Y-tal (sample)','lifting-equipment','YT-500-ECO',
  'Single-phase 500 kg construction winch for building-material lifting.',
  'Robust 500 kg capacity winch suited to residential and small commercial construction sites. Eco model with single-phase motor, steel drum and mechanical brake. SAMPLE PRODUCT DATA.',
  'Nos',48500.00,39000.00,18.00,'84253100','show_price',3,true),
 ('YT-WN-500P','y-tal-500kg-winch-plus','Y-tal 500 kg Winch — Plus Model','y-tal','Y-tal (sample)','lifting-equipment','YT-500-PLUS',
  'Heavy-duty 500 kg winch with higher lifting height and electromagnetic brake.',
  'Plus model with copper-wound 3 HP motor, electromagnetic brake, limit switch and 60 m rope capacity. Built for continuous site duty. SAMPLE PRODUCT DATA.',
  'Nos',62500.00,50500.00,18.00,'84253100','show_price',3,true),
 ('YT-WN-1000','y-tal-1-ton-winch','Y-tal 1 Ton Winch','y-tal','Y-tal (sample)','construction-equipment','YT-1000',
  'Three-phase 1 ton winch for medium construction projects.',
  'Three-phase 1 ton winch with reduction gearbox, electromagnetic brake and pendant control. SAMPLE PRODUCT DATA.',
  'Nos',98000.00,81000.00,18.00,'84253100','on_request',2,false),
 ('YT-MC-FR01','mini-crane-frame','Mini Crane Frame (Rooftop)','y-tal','Y-tal (sample)','mini-cranes','YT-MCF-01',
  'Rooftop mini crane frame compatible with Y-tal 500 kg winches.',
  'Fabricated MS frame with swivel boom and counterweight tray. Pairs with Eco and Plus winch models. SAMPLE PRODUCT DATA.',
  'Set',27500.00,21000.00,18.00,'84261900','show_price',2,true),
 ('FP-PW-2200','pressure-washer-2200','Pressure Washer 2200 W','fermier-pro','Fermier Pro (sample)','pressure-washers','FP-PW2200',
  'Induction-motor pressure washer for vehicle and site cleaning.',
  'Commercial pressure washer with induction motor, brass pump head and 10 m hose. SAMPLE PRODUCT DATA.',
  'Nos',18900.00,14200.00,18.00,'84243000','show_price',5,true),
 ('FP-PW-3000','pressure-washer-3000-heavy','Pressure Washer 3 HP Heavy Duty','fermier-pro','Fermier Pro (sample)','pressure-washers','FP-PW3000',
  'Three-cylinder plunger pump washer for workshops and service stations.',
  'Belt-driven plunger pump, 3 HP motor, suitable for continuous car wash operation. SAMPLE PRODUCT DATA.',
  'Nos',42000.00,33500.00,18.00,'84243000','show_price',3,false),
 ('AK-PWD-7HP','power-weeder-7hp','Power Weeder 7 HP Petrol','agriking','AgriKing (sample)','agriculture-garden-equipment','AK-PW7',
  'Petrol power weeder for inter-cultivation and soil preparation.',
  '7 HP four-stroke petrol engine with adjustable tilling width and depth bar. SAMPLE PRODUCT DATA.',
  'Nos',54000.00,43000.00,12.00,'84322900','show_price',3,true),
 ('AK-BC-52','brush-cutter-52cc','Brush Cutter 52 cc','agriking','AgriKing (sample)','agriculture-garden-equipment','AK-BC52',
  'Two-stroke side-pack brush cutter with blade and nylon head.',
  'Lightweight 52 cc brush cutter supplied with 3T blade, nylon trimmer head and harness. SAMPLE PRODUCT DATA.',
  'Nos',11500.00,8600.00,12.00,'84332000','show_price',6,false),
 ('AT-AC-100L','air-compressor-100l','Air Compressor 3 HP 100 L','airtech','AirTech (sample)','air-compressors','AT-100L',
  'Single-stage piston compressor with 100 litre tank.',
  'Belt-driven twin-cylinder compressor, auto cut-off pressure switch, 100 L horizontal tank. SAMPLE PRODUCT DATA.',
  'Nos',36500.00,28800.00,18.00,'84148011','show_price',3,true),
 ('AT-AC-24L','air-compressor-24l-portable','Portable Air Compressor 24 L','airtech','AirTech (sample)','air-compressors','AT-24L',
  'Oil-free portable compressor for tyre inflation and spray painting.',
  'Direct-drive oil-free compressor with 24 L tank and quick coupler. SAMPLE PRODUCT DATA.',
  'Nos',9800.00,7300.00,18.00,'84148011','show_price',8,false),
 ('PM-GEN-3K','portable-generator-3kva','Portable Generator 3 kVA Petrol','powermax','PowerMax (sample)','generators','PM-G3000',
  'Recoil and electric-start petrol generator for site power.',
  '3 kVA petrol generator with AVR, 15 L fuel tank and low-oil shutdown. SAMPLE PRODUCT DATA.',
  'Nos',39500.00,31500.00,18.00,'85022010','show_price',3,true),
 ('PM-GEN-7K','diesel-generator-7kva','Diesel Generator 7.5 kVA Silent','powermax','PowerMax (sample)','generators','PM-D7500S',
  'Silent canopy diesel generator for standby power.',
  'Air-cooled diesel engine, acoustic enclosure, ATS-ready control panel. SAMPLE PRODUCT DATA.',
  'Nos',null,null,18.00,'85021100','on_request',1,false),
 ('FP-PT-2000','hand-pallet-truck-2t','Hand Pallet Truck 2 Ton','fermier-pro','Fermier Pro (sample)','material-handling-equipment','FP-HPT2',
  'Manual hydraulic pallet truck for warehouse handling.',
  '2 ton capacity, PU wheels, 1150 mm forks, sealed hydraulic pump. SAMPLE PRODUCT DATA.',
  'Nos',16500.00,12400.00,18.00,'84271000','show_price',4,false),
 ('FP-VC-30L','wet-dry-vacuum-30l','Wet & Dry Vacuum Cleaner 30 L','fermier-pro','Fermier Pro (sample)','car-washers-vacuum-cleaners','FP-VC30',
  'Stainless steel tank wet & dry vacuum for car wash bays.',
  '1400 W motor, 30 L stainless tank, blower function and accessory kit. SAMPLE PRODUCT DATA.',
  'Nos',8900.00,6500.00,18.00,'85081900','show_price',6,false),
 ('AK-FG-TH','thermal-fogging-machine','Thermal Fogging Machine','agriking','AgriKing (sample)','fogging-machines','AK-TF6',
  'Portable pulse-jet thermal fogger for vector control.',
  'Pulse-jet thermal fogger with 6 L chemical tank, battery ignition. SAMPLE PRODUCT DATA.',
  'Nos',26500.00,20500.00,18.00,'84243000','show_price',2,false),
 ('PM-WM-200','inverter-welding-machine-200a','Inverter Welding Machine 200 A','powermax','PowerMax (sample)','welding-equipment','PM-ARC200',
  'IGBT inverter ARC welder for site fabrication.',
  'Single-phase IGBT inverter, hot-start and anti-stick, suitable for 2.5–4 mm electrodes. SAMPLE PRODUCT DATA.',
  'Nos',12800.00,9600.00,18.00,'85153100','show_price',5,false),
 ('PM-DB-1500','demolition-breaker-1500w','Demolition Breaker 1500 W','powermax','PowerMax (sample)','power-tools','PM-DB15',
  'Hexagonal-shank demolition hammer for concrete breaking.',
  '1500 W demolition breaker, 45 J impact energy, supplied with point and flat chisels. SAMPLE PRODUCT DATA.',
  'Nos',14500.00,10900.00,18.00,'84672900','show_price',4,true),
 ('PM-AG-4','angle-grinder-4in','Angle Grinder 4 inch 850 W','powermax','PowerMax (sample)','power-tools','PM-AG850',
  '850 W angle grinder for cutting and grinding.',
  'Compact 100 mm angle grinder with side handle and guard. SAMPLE PRODUCT DATA.',
  'Nos',2450.00,1750.00,18.00,'84672900','show_price',15,false)
) as v(sku, slug, name, brand, mfr, cat, model, short_d, long_d, unit, price, cost, tax, hsn, vis, reorder, featured);

-- Specifications (rendered dynamically by the UI)
insert into product_specifications (product_id, spec_group, label, value, sort_order)
select p.id, s.grp, s.label, s.value, s.ord from products p
join (values
 ('YT-WN-500E','Motor','Motor power','2 HP',1),('YT-WN-500E','Motor','Phase','Single phase',2),('YT-WN-500E','Motor','Voltage','220 V',3),
 ('YT-WN-500E','Performance','Load capacity','500 kg',4),('YT-WN-500E','Performance','Lifting height','40 m',5),
 ('YT-WN-500E','Performance','Rope diameter','8 mm',6),('YT-WN-500E','Performance','Lifting speed','18 m/min',7),
 ('YT-WN-500P','Motor','Motor power','3 HP',1),('YT-WN-500P','Motor','Phase','Single phase',2),('YT-WN-500P','Motor','Voltage','220 V',3),
 ('YT-WN-500P','Motor','Winding','Copper',4),('YT-WN-500P','Performance','Load capacity','500 kg',5),
 ('YT-WN-500P','Performance','Lifting height','60 m',6),('YT-WN-500P','Performance','Rope diameter','8 mm',7),
 ('YT-WN-500P','Safety','Brake','Electromagnetic',8),('YT-WN-500P','Safety','Limit switch','Yes',9),
 ('YT-WN-1000','Motor','Motor power','5 HP',1),('YT-WN-1000','Motor','Phase','Three phase',2),('YT-WN-1000','Motor','Voltage','415 V',3),
 ('YT-WN-1000','Performance','Load capacity','1000 kg',4),('YT-WN-1000','Performance','Lifting height','50 m',5),
 ('YT-WN-1000','Performance','Rope diameter','10 mm',6),
 ('YT-MC-FR01','Structure','Material','Mild steel',1),('YT-MC-FR01','Structure','Boom swivel','180°',2),
 ('YT-MC-FR01','Structure','Compatible winch','500 kg Eco / Plus',3),('YT-MC-FR01','Structure','Weight','95 kg',4),
 ('FP-PW-2200','Motor','Power','2200 W',1),('FP-PW-2200','Motor','Motor type','Induction',2),
 ('FP-PW-2200','Performance','Max pressure','150 bar',3),('FP-PW-2200','Performance','Flow rate','8 L/min',4),('FP-PW-2200','Accessories','Hose length','10 m',5),
 ('FP-PW-3000','Motor','Motor power','3 HP',1),('FP-PW-3000','Motor','Phase','Single phase',2),
 ('FP-PW-3000','Performance','Max pressure','170 bar',3),('FP-PW-3000','Performance','Flow rate','12 L/min',4),('FP-PW-3000','Pump','Pump type','3-plunger, belt driven',5),
 ('AK-PWD-7HP','Engine','Engine','7 HP, 4-stroke petrol',1),('AK-PWD-7HP','Engine','Fuel tank','3.6 L',2),
 ('AK-PWD-7HP','Performance','Tilling width','900 mm',3),('AK-PWD-7HP','Performance','Tilling depth','100–150 mm',4),
 ('AK-BC-52','Engine','Displacement','52 cc, 2-stroke',1),('AK-BC-52','Engine','Power','1.4 kW',2),('AK-BC-52','Accessories','Included','3T blade, nylon head, harness',3),
 ('AT-AC-100L','Motor','Motor power','3 HP',1),('AT-AC-100L','Motor','Phase','Single phase',2),
 ('AT-AC-100L','Performance','Tank capacity','100 L',3),('AT-AC-100L','Performance','Max pressure','8 bar',4),('AT-AC-100L','Performance','Air delivery','10 CFM',5),
 ('AT-AC-24L','Motor','Power','1.5 HP',1),('AT-AC-24L','Performance','Tank capacity','24 L',2),('AT-AC-24L','Performance','Max pressure','8 bar',3),('AT-AC-24L','Performance','Type','Oil-free',4),
 ('PM-GEN-3K','Output','Rated output','3 kVA',1),('PM-GEN-3K','Output','Voltage','230 V',2),('PM-GEN-3K','Engine','Fuel','Petrol',3),
 ('PM-GEN-3K','Engine','Fuel tank','15 L',4),('PM-GEN-3K','Engine','Start','Recoil + electric',5),
 ('PM-GEN-7K','Output','Rated output','7.5 kVA',1),('PM-GEN-7K','Output','Phase','Single phase',2),('PM-GEN-7K','Engine','Fuel','Diesel',3),('PM-GEN-7K','Engine','Noise level','68 dB @ 7 m',4),
 ('FP-PT-2000','Performance','Capacity','2000 kg',1),('FP-PT-2000','Dimensions','Fork length','1150 mm',2),('FP-PT-2000','Dimensions','Fork width','550 mm',3),('FP-PT-2000','Wheels','Wheel material','Polyurethane',4),
 ('FP-VC-30L','Motor','Power','1400 W',1),('FP-VC-30L','Performance','Tank capacity','30 L',2),('FP-VC-30L','Performance','Tank material','Stainless steel',3),
 ('AK-FG-TH','Performance','Chemical tank','6 L',1),('AK-FG-TH','Performance','Fuel tank','1.2 L petrol',2),('AK-FG-TH','Performance','Ignition','Battery',3),
 ('PM-WM-200','Electrical','Input','Single phase 230 V',1),('PM-WM-200','Electrical','Output current','20–200 A',2),('PM-WM-200','Electrical','Electrode size','2.5–4 mm',3),
 ('PM-DB-1500','Motor','Power','1500 W',1),('PM-DB-1500','Performance','Impact energy','45 J',2),('PM-DB-1500','Performance','Shank','30 mm hex',3),
 ('PM-AG-4','Motor','Power','850 W',1),('PM-AG-4','Performance','Disc diameter','100 mm',2),('PM-AG-4','Performance','No-load speed','11,000 rpm',3)
) as s(sku, grp, label, value, ord) on s.sku = p.sku;

-- Opening stock through the movement ledger so balances and history agree.
do $$
declare r record; wh uuid := (select id from warehouses where is_default);
begin
  for r in select p.id, v.qty from products p join (values
    ('YT-WN-500E',14),('YT-WN-500P',9),('YT-WN-1000',3),('YT-MC-FR01',6),('FP-PW-2200',22),('FP-PW-3000',4),
    ('AK-PWD-7HP',7),('AK-BC-52',2),('AT-AC-100L',11),('AT-AC-24L',18),('PM-GEN-3K',5),('PM-GEN-7K',0),
    ('FP-PT-2000',10),('FP-VC-30L',3),('AK-FG-TH',1),('PM-WM-200',16),('PM-DB-1500',12),('PM-AG-4',40)
  ) as v(sku, qty) on v.sku = p.sku loop
    insert into inventory_balances(product_id, warehouse_id) values (r.id, wh);
    if r.qty > 0 then
      perform apply_inventory_movement(r.id, wh, 'goods_received', r.qty, 0, 'opening_balance', null, 'OPENING',
        'Sample opening stock', null);
    end if;
  end loop;
end $$;

-- Sample customers (fictional; GSTIN deliberately left blank)
insert into customers (customer_code, company_name, customer_type, primary_contact, email, phone, billing_address, state, payment_terms, credit_limit, internal_notes, is_sample_data)
values
 ('CUS-DEMO-001','Sample Builders Pvt Ltd (Demo)','contractor','Demo Contact A','buyer@sample-builders.example','+91 90000 00001','Demo address line, Chennai','Tamil Nadu','Net 30',1000000,'Sample customer for demo',true),
 ('CUS-DEMO-002','Demo Agro Traders (Sample)','dealer','Demo Contact B','orders@demo-agro.example','+91 90000 00002','Demo address line, Coimbatore','Tamil Nadu','Advance',null,'Sample customer for demo',true),
 ('CUS-DEMO-003','Example Car Care Centre (Demo)','retail','Demo Contact C','owner@example-carcare.example','+91 90000 00003','Demo address line, Bengaluru','Karnataka','Net 15',300000,'Sample customer for demo',true);

insert into customer_addresses (customer_id, label, line1, city, state, postal_code, is_default)
select id, 'Site office', 'Demo site address', 'Chennai', 'Tamil Nadu', '600001', true from customers where customer_code = 'CUS-DEMO-001';
insert into customer_addresses (customer_id, label, line1, city, state, postal_code, is_default)
select id, 'Warehouse', 'Demo godown address', 'Coimbatore', 'Tamil Nadu', '641001', true from customers where customer_code = 'CUS-DEMO-002';

insert into suppliers (supplier_code, name, contact_person, phone, email, payment_terms, notes) values
 ('SUP-DEMO-001','Sample Winch Manufacturing (Demo)','Demo Supplier Contact','+91 90000 10001','supply@sample-winch.example','Net 45','Sample supplier'),
 ('SUP-DEMO-002','Demo Power Equipment Imports (Sample)','Demo Supplier Contact','+91 90000 10002','imports@demo-power.example','Advance','Sample supplier');
insert into supplier_products (supplier_id, product_id, lead_time_days)
select s.id, p.id, 14 from suppliers s, products p where s.supplier_code = 'SUP-DEMO-001' and p.sku like 'YT-%';
insert into supplier_products (supplier_id, product_id, lead_time_days)
select s.id, p.id, 30 from suppliers s, products p where s.supplier_code = 'SUP-DEMO-002' and p.sku like 'PM-%';
