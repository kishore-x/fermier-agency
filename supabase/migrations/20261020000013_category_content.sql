-- Rich category landing-page content (edited in Admin → Categories)
alter table categories
  add column overview text,
  add column key_points text[] not null default '{}',
  add column applications text[] not null default '{}',
  add column buying_guide jsonb not null default '[]',  -- [{ "title": "...", "text": "..." }]
  add column faqs jsonb not null default '[]';          -- [{ "q": "...", "a": "..." }]

alter table categories add constraint chk_buying_guide_array check (jsonb_typeof(buying_guide) = 'array');
alter table categories add constraint chk_faqs_array check (jsonb_typeof(faqs) = 'array');
