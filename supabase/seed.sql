-- Fermier Agency demo seed. ALL records here are SAMPLE DATA for demonstration only.
-- Prices, stock levels and customers are fictional. No real GSTINs or registration numbers.

insert into company_settings (company_name, legal_name, address, phone, email, whatsapp_number, default_terms)
values ('Fermier Agency', 'Fermier Agency (Sample)', 'Chennai, Tamil Nadu, India', '+91 44 xxxx xxxx',
        'sales@fermieragency.com', '910000000000',
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
 ('Y-tal','y-tal'),('Fermier Pro','fermier-pro'),('PowerMax','powermax'),('AgriKing','agriking'),('AirTech','airtech'),
 ('Kaeser','kaeser'),('Bosch','bosch'),('Honda','honda');

-- Products
with c as (select slug, id from categories), b as (select slug, id from brands)
insert into products (sku, slug, name, brand_id, manufacturer, category_id, model_number, short_description, description,
  unit, selling_price, tax_rate, hsn_code, price_visibility, reorder_threshold, is_featured, status, is_sample_data)
select v.sku, v.slug, v.name, (select id from b where b.slug = v.brand), v.mfr, (select id from c where c.slug = v.cat),
  v.model, v.short_d, v.long_d, v.unit, v.price, v.tax, v.hsn, v.vis::price_visibility, v.reorder, v.featured,
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
 ('AT-AC-100L','kaeser-air-compressor','Kaeser Air Compressor','kaeser','Kaeser (sample listing)','air-compressors','KCT-200',
  'Reliable performance for workshop and site use.',
  'Belt-driven twin-cylinder piston compressor with 200 L horizontal tank and auto cut-off pressure switch. SAMPLE PRODUCT DATA — price and stock are indicative.',
  'Nos',36500.00,28800.00,18.00,'84148011','show_price',3,true),
 ('AT-AC-24L','air-compressor-24l-portable','Portable Air Compressor 24 L','airtech','AirTech (sample)','air-compressors','AT-24L',
  'Oil-free portable compressor for tyre inflation and spray painting.',
  'Direct-drive oil-free compressor with 24 L tank and quick coupler. SAMPLE PRODUCT DATA.',
  'Nos',9800.00,7300.00,18.00,'84148011','show_price',8,false),
 ('PM-GEN-3K','honda-generator','Honda Generator','honda','Honda (sample listing)','generators','EP 5000',
  'Quiet and fuel efficient for continuous operation.',
  '5 kVA petrol generator with AVR and low-oil shutdown. SAMPLE PRODUCT DATA — price and stock are indicative.',
  'Nos',89500.00,31500.00,18.00,'85022010','show_price',3,true),
 ('PM-GEN-7K','diesel-generator-7kva','Diesel Generator 7.5 kVA Silent','powermax','PowerMax (sample)','generators','PM-D7500S',
  'Silent canopy diesel generator for standby power.',
  'Air-cooled diesel engine, acoustic enclosure, ATS-ready control panel. SAMPLE PRODUCT DATA.',
  'Nos',null,null,18.00,'85021100','on_request',1,false),
 ('FP-PT-2000','semi-electric-stacker','Semi Electric Stacker','fermier-pro','Fermier Pro (sample)','material-handling-equipment','FP-SES15',
  'Ideal for warehouse and material handling.',
  'Battery-powered lifting with manual travel, 1.5 ton capacity and 3 m lift height. SAMPLE PRODUCT DATA.',
  'Nos',145000.00,112000.00,18.00,'84272000','show_price',2,true),
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
 ('PM-DB-1500','bosch-rotary-hammer-drill','Bosch Rotary Hammer Drill','bosch','Bosch (sample listing)','power-tools','GBH 2-26',
  'Heavy-duty drilling for concrete and masonry.',
  'SDS-plus rotary hammer with drilling, hammer-drilling and chiselling modes. SAMPLE PRODUCT DATA — price and stock are indicative.',
  'Nos',14500.00,10900.00,18.00,'84672900','show_price',4,true),
 ('PM-AG-4','angle-grinder-4in','Angle Grinder 4 inch 850 W','powermax','PowerMax (sample)','power-tools','PM-AG850',
  '850 W angle grinder for cutting and grinding.',
  'Compact 100 mm angle grinder with side handle and guard. SAMPLE PRODUCT DATA.',
  'Nos',2450.00,1750.00,18.00,'84672900','show_price',15,false)
) as v(sku, slug, name, brand, mfr, cat, model, short_d, long_d, unit, price, cost, tax, hsn, vis, reorder, featured);

insert into product_costs (product_id, purchase_cost)
select p.id, c.cost from products p join (values
 ('YT-WN-500E',39000.00),('YT-WN-500P',50500.00),('YT-WN-1000',81000.00),('YT-MC-FR01',21000.00),('FP-PW-2200',14200.00),
 ('FP-PW-3000',33500.00),('AK-PWD-7HP',43000.00),('AK-BC-52',8600.00),('AT-AC-100L',28800.00),('AT-AC-24L',7300.00),
 ('PM-GEN-3K',72000.00),('PM-GEN-7K',null),('FP-PT-2000',112000.00),('FP-VC-30L',6500.00),('AK-FG-TH',20500.00),
 ('PM-WM-200',9600.00),('PM-DB-1500',10900.00),('PM-AG-4',1750.00)
) as c(sku, cost) on c.sku = p.sku;

update products set is_featured = false;
update products p set is_featured = true, featured_rank = r.rank
from (values ('AT-AC-100L',7),('PM-DB-1500',8),('FP-PT-2000',9),('PM-GEN-3K',10),('YT-WN-500P',11),('YT-WN-500E',12)) as r(sku, rank)
where p.sku = r.sku;

-- Category and product photos (cropped from the reference design; replace with licensed photography)
update categories c set image_url = v.url from (values
 ('construction-equipment','/demo/cat-construction.jpg'),('lifting-equipment','/demo/cat-lifting.jpg'),
 ('material-handling-equipment','/demo/cat-material.jpg'),('generators','/demo/cat-generators.jpg'),
 ('car-washers-vacuum-cleaners','/demo/cat-washers.jpg'),('agriculture-garden-equipment','/demo/cat-agri.jpg'),
 ('pressure-washers','/demo/quick-washer.jpg'),('mini-cranes','/demo/quick-winch.jpg'),('air-compressors','/demo/prod-compressor.jpg'),
 ('power-tools','/demo/prod-drill.jpg')
) as v(slug, url) where c.slug = v.slug;

insert into product_images (product_id, url, alt, sort_order)
select p.id, v.url, p.name, 0 from products p join (values
 ('AT-AC-100L','/demo/prod-compressor.jpg'),('PM-DB-1500','/demo/prod-drill.jpg'),('FP-PT-2000','/demo/prod-stacker.jpg'),
 ('PM-GEN-3K','/demo/prod-generator.jpg'),('YT-WN-500P','/demo/quick-winch.jpg'),('YT-WN-500E','/demo/quick-winch.jpg'),
 ('PM-GEN-7K','/demo/cat-generators.jpg'),('FP-PW-2200','/demo/cat-washers.jpg'),('FP-PW-3000','/demo/quick-washer.jpg'),
 ('AK-PWD-7HP','/demo/cat-agri.jpg')
) as v(sku, url) on v.sku = p.sku;

-- ===== Reference-design catalogue (construction equipment) =====
insert into categories (name, slug, description, sort_order, image_url) values
 ('Concrete Floor Finishing Equipment','concrete-floor-finishing-equipment','Power trowels and floor finishing machines',1,'/site/cat-floor-finishing.jpg'),
 ('Compaction Equipment','compaction-equipment','Plate compactors, rammers and rollers',2,'/site/cat-compaction.jpg'),
 ('Concrete Cutting Equipment','concrete-cutting-equipment','Floor saws and concrete cutters',3,'/site/cat-concrete-cutting.jpg'),
 ('Lighting Towers','lighting-towers','Mobile LED and metal-halide lighting towers',4,'/site/cat-lighting-towers.jpg');
update categories c set sort_order = v.o, image_url = coalesce(v.img, c.image_url) from (values
 ('generators',5,'/site/cat-generators.jpg'),('air-compressors',6,'/site/cat-air-compressors.jpg'),
 ('material-handling-equipment',7,'/site/cat-material-handling.jpg'),('power-tools',8,'/site/cat-power-tools.jpg'),
 ('construction-equipment',9,null),('lifting-equipment',10,null),('car-washers-vacuum-cleaners',11,null),
 ('agriculture-garden-equipment',12,null),('pressure-washers',13,null),('fogging-machines',14,null),('mini-cranes',15,null),('welding-equipment',16,null)
) as v(slug, o, img) where c.slug = v.slug;

insert into brands (name, slug, logo_url) values
 ('Masalta','masalta','/site/brand-masalta.png'),('Wacker Neuson','wacker-neuson','/site/brand-wacker.png'),
 ('Bomag','bomag','/site/brand-bomag.png'),('Mikasa','mikasa','/site/brand-mikasa.png'),
 ('Belle','belle','/site/brand-belle.png'),('Dynapac','dynapac','/site/brand-dynapac.png'),
 ('JCB','jcb',null),('Atlas Copco','atlas-copco',null),('Generac','generac',null);

with c as (select slug, id from categories), b as (select slug, id from brands)
insert into products (sku, slug, name, brand_id, manufacturer, category_id, model_number, short_description, description,
  unit, selling_price, tax_rate, hsn_code, price_visibility, reorder_threshold, is_featured, featured_rank, status, is_sample_data)
select v.sku, v.slug, v.name, (select id from b where b.slug = v.brand), v.mfr, (select id from c where c.slug = v.cat), v.model,
  v.short_d, v.long_d, 'Nos', v.price, 18.00, v.hsn, v.vis::price_visibility, 1, true, v.rnk, 'active', true
from (values
 ('MS-MT36','masalta-mt36-power-trowel','Masalta MT36','masalta','Masalta (sample listing)','concrete-floor-finishing-equipment','MT36',
  'Walk-behind power trowel for concrete floor finishing.','36" walk-behind power trowel with 6.5 HP petrol engine, pitch control and safety stop. SAMPLE PRODUCT DATA.',
  165000.00,'84798200','show_price',1),
 ('WN-VP1550','wacker-neuson-vp1550-plate-compactor','Wacker Neuson VP1550','wacker-neuson','Wacker Neuson (sample listing)','compaction-equipment','VP1550',
  'Single-direction vibratory plate for soil and asphalt.','24 kN centrifugal force vibratory plate compactor with petrol engine and water tank. SAMPLE PRODUCT DATA.',
  98000.00,'84294000','show_price',2),
 ('MS-MF14','masalta-mf14-concrete-cutter','Masalta MF14','masalta','Masalta (sample listing)','concrete-cutting-equipment','MF14',
  'Walk-behind floor saw for concrete and asphalt.','14" blade concrete cutter with 13 HP petrol engine and water cooling. SAMPLE PRODUCT DATA.',
  112000.00,'84649000','show_price',3),
 ('JCB-G115QS','jcb-g115qs-generator','JCB G115QS','jcb','JCB (sample listing)','generators','G115QS',
  'Super-silent diesel generator for site power.','115 kVA diesel generator in a sound-attenuated canopy. SAMPLE PRODUCT DATA.',
  null,'85021320','on_request',4),
 ('AC-XAS186','atlas-copco-xas-186-air-compressor','Atlas Copco XAS 186','atlas-copco','Atlas Copco (sample listing)','air-compressors','XAS 186',
  'Portable diesel screw compressor.','Towable 186 CFM, 7 bar diesel-driven screw compressor. SAMPLE PRODUCT DATA.',
  null,'84148011','on_request',5),
 ('GN-MLT4060','generac-mlt4060-lighting-tower','Generac MLT4060','generac','Generac (sample listing)','lighting-towers','MLT4060',
  'Mobile LED lighting tower.','Towable lighting tower with 4 x 1000 W LED lamps and hydraulic mast. SAMPLE PRODUCT DATA.',
  null,'94054090','on_request',6)
) as v(sku, slug, name, brand, mfr, cat, model, short_d, long_d, price, hsn, vis, rnk);

insert into product_specifications (product_id, spec_group, label, value, sort_order)
select p.id, s.grp, s.label, s.value, s.ord from products p join (values
 ('MS-MT36','Overview','Type','Power Trowel',0),('MS-MT36','Performance','Trowel diameter','36"',1),('MS-MT36','Engine','Engine power','6.5 HP',2),('MS-MT36','Engine','Fuel','Petrol',3),
 ('WN-VP1550','Overview','Type','Plate Compactor',0),('WN-VP1550','Performance','Centrifugal force','24 kN',1),('WN-VP1550','Engine','Fuel','Petrol',2),('WN-VP1550','Performance','Plate width','500 mm',3),
 ('MS-MF14','Overview','Type','Concrete Cutter',0),('MS-MF14','Performance','Blade diameter','14"',1),('MS-MF14','Engine','Engine power','13 HP',2),('MS-MF14','Performance','Max cutting depth','125 mm',3),
 ('JCB-G115QS','Overview','Type','Generator',0),('JCB-G115QS','Output','Prime power','115 kVA',1),('JCB-G115QS','Engine','Fuel','Diesel',2),('JCB-G115QS','Output','Phase','Three phase',3),
 ('AC-XAS186','Overview','Type','Air Compressor',0),('AC-XAS186','Performance','Free air delivery','186 CFM',1),('AC-XAS186','Performance','Working pressure','7 bar',2),('AC-XAS186','Engine','Fuel','Diesel',3),
 ('GN-MLT4060','Overview','Type','Lighting Tower',0),('GN-MLT4060','Performance','Lamps','4 x 1000W LED',1),('GN-MLT4060','Performance','Mast height','9 m',2),('GN-MLT4060','Engine','Fuel','Diesel',3)
) as s(sku, grp, label, value, ord) on s.sku = p.sku;

insert into product_images (product_id, url, alt, sort_order)
select p.id, v.url, p.name, 0 from products p join (values
 ('MS-MT36','/site/prod-masalta-mt36.jpg'),('WN-VP1550','/site/prod-wacker-vp1550.jpg'),('MS-MF14','/site/prod-masalta-mf14.jpg'),
 ('JCB-G115QS','/site/prod-jcb-g115qs.jpg'),('AC-XAS186','/site/prod-atlas-xas186.jpg'),('GN-MLT4060','/site/prod-generac-mlt4060.jpg')
) as v(sku, url) on v.sku = p.sku;

insert into product_costs (product_id, purchase_cost)
select p.id, v.cost from products p join (values ('MS-MT36',128000.00),('WN-VP1550',76000.00),('MS-MF14',87000.00),('JCB-G115QS',1450000.00),('AC-XAS186',1180000.00),('GN-MLT4060',640000.00)) as v(sku, cost) on v.sku = p.sku;

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
 ('AT-AC-100L','Motor','Motor power','3 HP',1),('AT-AC-100L','Performance','Tank capacity','200 L',2),('AT-AC-100L','Performance','Max pressure','8 bar',3),
 ('AT-AC-100L','Motor','Phase','Single phase',4),('AT-AC-100L','Performance','Air delivery','10 CFM',5),
 ('AT-AC-24L','Motor','Power','1.5 HP',1),('AT-AC-24L','Performance','Tank capacity','24 L',2),('AT-AC-24L','Performance','Max pressure','8 bar',3),('AT-AC-24L','Performance','Type','Oil-free',4),
 ('PM-GEN-3K','Output','Rated output','5 kVA',1),('PM-GEN-3K','Engine','Fuel','Petrol',2),('PM-GEN-3K','Output','Phase','Single Phase',3),
 ('PM-GEN-3K','Output','Voltage','230 V',4),('PM-GEN-3K','Engine','Fuel tank','24 L',5),
 ('PM-GEN-7K','Output','Rated output','7.5 kVA',1),('PM-GEN-7K','Output','Phase','Single phase',2),('PM-GEN-7K','Engine','Fuel','Diesel',3),('PM-GEN-7K','Engine','Noise level','68 dB @ 7 m',4),
 ('FP-PT-2000','Performance','Capacity','1.5 Ton',1),('FP-PT-2000','Performance','Lift height','3 m Lift',2),('FP-PT-2000','Power','Lift drive','Battery electric',3),('FP-PT-2000','Power','Travel','Manual',4),
 ('FP-VC-30L','Motor','Power','1400 W',1),('FP-VC-30L','Performance','Tank capacity','30 L',2),('FP-VC-30L','Performance','Tank material','Stainless steel',3),
 ('AK-FG-TH','Performance','Chemical tank','6 L',1),('AK-FG-TH','Performance','Fuel tank','1.2 L petrol',2),('AK-FG-TH','Performance','Ignition','Battery',3),
 ('PM-WM-200','Electrical','Input','Single phase 230 V',1),('PM-WM-200','Electrical','Output current','20–200 A',2),('PM-WM-200','Electrical','Electrode size','2.5–4 mm',3),
 ('PM-DB-1500','Motor','Power','800 W',1),('PM-DB-1500','Performance','Max drilling (concrete)','26 mm',2),('PM-DB-1500','Performance','Impact energy','2.7 J',3),('PM-DB-1500','Performance','Chuck','SDS-plus',4),
 ('PM-AG-4','Motor','Power','850 W',1),('PM-AG-4','Performance','Disc diameter','100 mm',2),('PM-AG-4','Performance','No-load speed','11,000 rpm',3)
) as s(sku, grp, label, value, ord) on s.sku = p.sku;

-- Opening stock through the movement ledger so balances and history agree.
do $$
declare r record; wh uuid := (select id from warehouses where is_default);
begin
  for r in select p.id, v.qty from products p join (values
    ('YT-WN-500E',14),('YT-WN-500P',9),('YT-WN-1000',3),('YT-MC-FR01',6),('FP-PW-2200',22),('FP-PW-3000',4),
    ('AK-PWD-7HP',7),('AK-BC-52',2),('AT-AC-100L',11),('AT-AC-24L',18),('PM-GEN-3K',5),('PM-GEN-7K',0),
    ('FP-PT-2000',10),('FP-VC-30L',3),('AK-FG-TH',1),('PM-WM-200',16),('PM-DB-1500',12),('PM-AG-4',40),
    ('MS-MT36',6),('WN-VP1550',9),('MS-MF14',4),('JCB-G115QS',2),('AC-XAS186',2),('GN-MLT4060',3)
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

-- ===== Rich product content (SAMPLE copy — verify against manufacturer datasheets before publishing) =====
update products p set description = v.descr, features = v.feat, applications = v.app, in_the_box = v.box, warranty = v.warr
from (values
 ('WN-VP1550',
  'The Wacker Neuson VP1550 is a single-direction vibratory plate compactor built for compacting granular soils, gravel and asphalt in confined areas. A 24 kN centrifugal force delivers deep, uniform compaction, while the low-vibration guide handle and integrated water tank make it suitable for both sub-base preparation and asphalt patch work. Its compact footprint lets it work close to kerbs, foundations and trench walls where rollers cannot reach. SAMPLE PRODUCT DATA.',
  array['24 kN centrifugal force for deep, uniform compaction','Low hand-arm vibration guide handle for operator comfort','Integrated water sprinkler tank for asphalt work','Heavy-duty ductile base plate with rounded edges','Central lifting eye and transport wheel kit','Petrol engine with low-oil shutdown protection'],
  array['Sub-base and backfill compaction','Interlocking paver bedding','Asphalt patch and repair work','Trench and foundation backfill','Landscaping and driveway preparation'],
  array['VP1550 plate compactor','Water tank (10 L)','Guide handle assembly','Operator manual and tool kit'],
  '12 months manufacturer warranty against manufacturing defects; engine covered by engine-maker warranty.'),
 ('MS-MT36',
  'The Masalta MT36 is a 36-inch walk-behind power trowel for floating and finishing concrete slabs. Pitch control lets the operator move from floating pans to finishing blades without stopping, and the centrifugal safety stop cuts drive the moment the handle is released. Ideal for warehouse floors, parking decks and industrial slabs. SAMPLE PRODUCT DATA.',
  array['36" working diameter with four blades','Quick-pitch blade adjustment','Centrifugal safety stop switch','Foldable, height-adjustable handle','Balanced design for easy handling'],
  array['Industrial and warehouse floors','Parking decks and podium slabs','Residential and commercial slabs','Floor hardener finishing'],
  array['MT36 power trowel','Combination blades (set of 4)','Lifting hook','Operator manual'],
  '12 months warranty on machine; engine as per engine manufacturer.'),
 ('MS-MF14',
  'The Masalta MF14 walk-behind floor saw cuts expansion joints and trenches in concrete and asphalt. A 14-inch blade, water-cooled cutting system and depth hand-wheel give clean, accurate cuts up to 125 mm deep. SAMPLE PRODUCT DATA.',
  array['Up to 125 mm cutting depth','Water cooling with 25 L tank','Precision depth hand-wheel','Front pointer for straight cuts','Blade guard with lifting front'],
  array['Expansion and control joints','Road and runway repair','Trenching for utilities','Concrete demolition preparation'],
  array['MF14 floor saw','Water tank','Blade spanner','Operator manual'],
  '12 months warranty on machine; blades are consumables.'),
 ('JCB-G115QS',
  'The JCB G115QS is a 115 kVA super-silent diesel generator in a weather-proof acoustic canopy, designed for continuous site power, events and standby duty. SAMPLE PRODUCT DATA.',
  array['Super-silent acoustic canopy','Digital control panel with auto start','Integrated fuel tank for long run time','Bunded base to contain spills','Forklift pockets and lifting point'],
  array['Construction site power','Standby power for commercial buildings','Events and temporary installations'],
  array['Generator set','Battery and charger','Control panel keys','Operation and maintenance manual'],
  '24 months or 3000 hours, whichever is earlier (sample terms).'),
 ('AC-XAS186',
  'The Atlas Copco XAS 186 is a towable diesel screw compressor delivering 186 CFM at 7 bar for pneumatic tools and sandblasting on site. SAMPLE PRODUCT DATA.',
  array['186 CFM free air delivery at 7 bar','Reliable rotary screw element','Spillage-free frame','Easy-access service doors','Road-towable chassis'],
  array['Pneumatic breakers and drills','Sandblasting','Pipeline testing','Construction and mining sites'],
  array['XAS 186 compressor','Tow bar and lights','Operator manual'],
  '12 months warranty (sample terms).'),
 ('GN-MLT4060',
  'The Generac MLT4060 mobile lighting tower provides 4 x 1000 W equivalent LED illumination on a 9 m hydraulic mast for night work and large-area lighting. SAMPLE PRODUCT DATA.',
  array['4 x high-output LED lamps','9 m hydraulic mast','Long run time on a single tank','Outriggers for stability','Road-towable trailer'],
  array['Night-time construction','Road works','Mining and quarry sites','Events and emergency response'],
  array['Lighting tower','Outrigger pins','Operator manual'],
  '12 months warranty (sample terms).'),
 ('YT-WN-500E',
  'The Y-tal 500 kg Winch Eco Model is a single-phase construction winch for lifting bricks, cement bags, steel and other building materials to upper floors. Paired with the Y-tal mini crane frame it forms a complete rooftop material hoist. SAMPLE PRODUCT DATA.',
  array['500 kg lifting capacity','Runs on 220 V single-phase supply','40 m lifting height with 8 mm wire rope','Mechanical brake with pendant remote','Rope guide and voltage meter on remote'],
  array['Residential and small commercial construction','Lifting cement, bricks, sand and steel','Rooftop material hoisting with mini crane'],
  array['Winch with drum and motor','40 m wire rope (8 mm)','Pendant remote','Mounting bolts'],
  '12 months warranty on motor and gearbox; wire rope is a consumable.'),
 ('YT-WN-500P',
  'The Y-tal 500 kg Winch Plus Model adds a copper-wound 3 HP motor, electromagnetic brake and limit switch for continuous, heavy site duty with a 60 m rope capacity. SAMPLE PRODUCT DATA.',
  array['3 HP copper-wound motor','Electromagnetic brake for instant hold','Upper limit switch for safety','60 m rope capacity','Rope guide with voltage meter'],
  array['Multi-storey residential projects','Continuous material lifting','Rooftop hoisting with mini crane frame'],
  array['Winch with drum and motor','60 m wire rope (8 mm)','Pendant remote with voltage meter','Mounting bolts'],
  '12 months warranty on motor and gearbox; wire rope is a consumable.'),
 ('YT-MC-FR01',
  'The Y-tal mini crane frame is a rooftop swivel frame that pairs with Y-tal 500 kg winches to form a complete material hoist. SAMPLE PRODUCT DATA.',
  array['Heavy MS fabricated frame','180° to 360° swivel boom','Counterweight tray','Compatible with Eco and Plus winches'],
  array['Rooftop material lifting','Building renovation and repair'],
  array['Frame, boom and swivel base','Counterweight tray','Fasteners'],
  '6 months warranty against fabrication defects.')
) as v(sku, descr, feat, app, box, warr)
where p.sku = v.sku;

-- Fuller spec sheets for the reference-design machines
delete from product_specifications where product_id in (select id from products where sku in ('WN-VP1550','MS-MT36','MS-MF14'));
insert into product_specifications (product_id, spec_group, label, value, sort_order)
select p.id, s.grp, s.label, s.value, s.ord from products p join (values
 ('WN-VP1550','Overview','Type','Plate Compactor',0),
 ('WN-VP1550','Performance','Centrifugal force','24 kN',1),('WN-VP1550','Performance','Vibration frequency','98 Hz',2),
 ('WN-VP1550','Performance','Travel speed','25 m/min',3),('WN-VP1550','Performance','Area capacity','750 m²/h',4),
 ('WN-VP1550','Performance','Compaction depth','up to 30 cm',5),
 ('WN-VP1550','Engine','Engine','Honda GX160 (or equivalent)',6),('WN-VP1550','Engine','Power','5.5 HP',7),
 ('WN-VP1550','Engine','Fuel','Petrol',8),('WN-VP1550','Engine','Fuel tank','3.6 L',9),('WN-VP1550','Engine','Water tank','10 L',10),
 ('WN-VP1550','Dimensions','Plate size (L x W)','585 x 500 mm',11),('WN-VP1550','Dimensions','Operating weight','86 kg',12),
 ('MS-MT36','Overview','Type','Power Trowel',0),('MS-MT36','Performance','Trowel diameter','36"',1),('MS-MT36','Performance','Blades','4',2),
 ('MS-MT36','Performance','Rotor speed','70–140 rpm',3),('MS-MT36','Engine','Engine power','6.5 HP',4),('MS-MT36','Engine','Fuel','Petrol',5),
 ('MS-MT36','Dimensions','Operating weight','80 kg',6),
 ('MS-MF14','Overview','Type','Concrete Cutter',0),('MS-MF14','Performance','Blade diameter','14"',1),('MS-MF14','Engine','Engine power','13 HP',2),
 ('MS-MF14','Performance','Max cutting depth','125 mm',3),('MS-MF14','Performance','Water tank','25 L',4),('MS-MF14','Engine','Fuel','Petrol',5),
 ('MS-MF14','Dimensions','Operating weight','92 kg',6)
) as s(sku, grp, label, value, ord) on s.sku = p.sku;
-- Brand / model shown on the card spec sheet come from the product itself; add voltage-style rows for winches

-- Machine type shown on the product card header strip
insert into product_specifications (product_id, spec_group, label, value, sort_order)
select p.id, 'Overview', 'Type', v.t, 0 from products p join (values
 ('YT-WN-500E','Mini Crane Winch'),('YT-WN-500P','Mini Crane Winch'),('YT-WN-1000','Construction Winch'),('YT-MC-FR01','Mini Crane Frame'),
 ('FP-PW-2200','Pressure Washer'),('FP-PW-3000','Pressure Washer'),('AK-PWD-7HP','Power Weeder'),('AK-BC-52','Brush Cutter'),
 ('AT-AC-100L','Air Compressor'),('AT-AC-24L','Air Compressor'),('PM-GEN-3K','Generator'),('PM-GEN-7K','Generator'),
 ('FP-PT-2000','Electric Stacker'),('FP-VC-30L','Wet & Dry Vacuum'),('AK-FG-TH','Thermal Fogger'),('PM-WM-200','Welding Machine'),
 ('PM-DB-1500','Rotary Hammer'),('PM-AG-4','Angle Grinder')
) as v(sku, t) on v.sku = p.sku;
