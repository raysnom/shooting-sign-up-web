-- ============================================
-- Migration 006: Insert guns and assign to members
-- ============================================
-- Air Pistol guns (14) and Air Rifle guns (8)
-- Member matching is by name prefix (case-insensitive)
-- Run AFTER all members have been imported.

-- ──────────────────────────────────────────────
-- AIR PISTOL GUNS
-- ──────────────────────────────────────────────

INSERT INTO guns (name, type) VALUES ('749268', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('903811', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('742084', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('749282', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('772349', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('772072', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('KHA9258', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('903807', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('751081', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('903808', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('906866', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('909628', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('905031', 'air_pistol');
INSERT INTO guns (name, type) VALUES ('909625', 'air_pistol');

-- Air Pistol assignments
-- Gun 749268: OWEN, YIYANG, RAYSON
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '749268') WHERE UPPER(name) LIKE 'OWEN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '749268') WHERE UPPER(name) LIKE 'YIYANG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '749268') WHERE UPPER(name) LIKE 'RAYSON%' AND archived = false;

-- Gun 903811: MANFRED, WAYAN, LILA
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903811') WHERE UPPER(name) LIKE 'MANFRED%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903811') WHERE UPPER(name) LIKE 'WAYAN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903811') WHERE UPPER(name) LIKE 'LILA%' AND archived = false;

-- Gun 742084: ETHAN, SURYA
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '742084') WHERE UPPER(name) LIKE 'ETHAN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '742084') WHERE UPPER(name) LIKE 'SURYA%' AND archived = false;

-- Gun 749282: ERYN, TAN CHEN
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '749282') WHERE UPPER(name) LIKE 'ERYN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '749282') WHERE UPPER(name) LIKE 'TAN CHEN%' AND archived = false;

-- Gun 772349: BAO HAN, RYAN, LEANNE
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '772349') WHERE UPPER(name) LIKE 'BAO HAN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '772349') WHERE UPPER(name) LIKE 'RYAN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '772349') WHERE UPPER(name) LIKE 'LEANNE%' AND archived = false;

-- Gun 772072: JOSHUA LEE, WEE WOON
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '772072') WHERE UPPER(name) LIKE 'JOSHUA LEE%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '772072') WHERE UPPER(name) LIKE 'WEE WOON%' AND archived = false;

-- Gun KHA9258: EDREA, XINYU, YUNA
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = 'KHA9258') WHERE UPPER(name) LIKE 'EDREA%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = 'KHA9258') WHERE UPPER(name) LIKE 'XINYU%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = 'KHA9258') WHERE UPPER(name) LIKE 'YUNA%' AND archived = false;

-- Gun 903807: KA TUNG, XAVIER PANG, SARA
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903807') WHERE UPPER(name) LIKE 'KA TUNG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903807') WHERE UPPER(name) LIKE 'XAVIER PANG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903807') WHERE UPPER(name) LIKE 'SARA%' AND archived = false;

-- Gun 751081: JOSHUA NG, JERVIN, KHOI
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '751081') WHERE UPPER(name) LIKE 'JOSHUA NG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '751081') WHERE UPPER(name) LIKE 'JERVIN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '751081') WHERE UPPER(name) LIKE 'KHOI%' AND archived = false;

-- Gun 903808: XIAOMEI, SOPHIE, XAVIER TAN
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903808') WHERE UPPER(name) LIKE 'XIAOMEI%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903808') WHERE UPPER(name) LIKE 'SOPHIE%' OR UPPER(name) LIKE 'SOHPIE%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '903808') WHERE UPPER(name) LIKE 'XAVIER TAN%' AND archived = false;

-- Gun 906866: ADITI, JING SHEN, YAN YU
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '906866') WHERE UPPER(name) LIKE 'ADITI%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '906866') WHERE UPPER(name) LIKE 'JING SHEN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '906866') WHERE UPPER(name) LIKE 'YAN YU%' AND archived = false;

-- Gun 909628: JING EN, JIAYU, GARETH
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909628') WHERE UPPER(name) LIKE 'JING EN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909628') WHERE UPPER(name) LIKE 'JIAYU%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909628') WHERE UPPER(name) LIKE 'GARETH%' AND archived = false;

-- Gun 905031: ISAAC, DEEPTIKA, JAMIE
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '905031') WHERE UPPER(name) LIKE 'ISAAC%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '905031') WHERE UPPER(name) LIKE 'DEEPTIKA%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '905031') WHERE UPPER(name) LIKE 'JAMIE%' AND archived = false;

-- Gun 909625: QUINTUS, NATHAN, SANDHYA
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909625') WHERE UPPER(name) LIKE 'QUINTUS%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909625') WHERE UPPER(name) LIKE 'NATHAN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '909625') WHERE UPPER(name) LIKE 'SANDHYA%' AND archived = false;

-- ──────────────────────────────────────────────
-- AIR RIFLE GUNS
-- ──────────────────────────────────────────────

INSERT INTO guns (name, type) VALUES ('702792', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('735674', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('708535', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('735655', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('730603', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('730722', 'air_rifle');
INSERT INTO guns (name, type) VALUES ('16808435', 'air_rifle');

-- Air Rifle assignments
-- Gun 702792: HENG ZHE EN ELIZABETH, FANG HONG YI
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '702792') WHERE UPPER(name) LIKE 'HENG ZHE EN%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '702792') WHERE UPPER(name) LIKE 'FANG HONG YI%' AND archived = false;

-- Gun 735674: WIN DEPAR HTUN, TEESHA DHIRAJ BABLANI, YEE EN TING
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735674') WHERE UPPER(name) LIKE 'WIN DEPAR%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735674') WHERE UPPER(name) LIKE 'TEESHA%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735674') WHERE UPPER(name) LIKE 'YEE EN TING%' AND archived = false;

-- Gun 708535: LIN CHANG, RACHEL LIM KAR YEE
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '708535') WHERE UPPER(name) LIKE 'LIN CHANG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '708535') WHERE UPPER(name) LIKE 'RACHEL LIM%' AND archived = false;

-- Gun 735655: SETH, CHUA ZHUO XI, ILAKIYA ANANTH
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735655') WHERE UPPER(name) LIKE 'SETH%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735655') WHERE UPPER(name) LIKE 'CHUA ZHUO XI%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '735655') WHERE UPPER(name) LIKE 'ILAKIYA%' AND archived = false;

-- Gun 730603: GAO XING
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '730603') WHERE UPPER(name) LIKE 'GAO XING%' AND archived = false;

-- Gun 730722: WANG JUNTONG, JOVAN ANG CHENG RUI
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '730722') WHERE UPPER(name) LIKE 'WANG JUNTONG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '730722') WHERE UPPER(name) LIKE 'JOVAN%' AND archived = false;

-- Gun 16808435: SHEO CHIONG HWEE, LIU YULIN
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '16808435') WHERE UPPER(name) LIKE 'SHEO CHIONG%' AND archived = false;
UPDATE members SET gun_id = (SELECT id FROM guns WHERE name = '16808435') WHERE UPPER(name) LIKE 'LIU YULIN%' AND archived = false;

-- ──────────────────────────────────────────────
-- Verification: check assignments
-- ──────────────────────────────────────────────
-- Run this after to verify:
-- SELECT m.name, g.name as gun_name, g.type FROM members m JOIN guns g ON m.gun_id = g.id ORDER BY g.type, g.name, m.name;
