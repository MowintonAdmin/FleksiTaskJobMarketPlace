--
-- PostgreSQL database dump
--

\restrict CFfKFc8J8pc0l6FIF5ObapcUGZ8ZKRtl6ZYped22iTddzAzz8D7EXKzNEZy6Pxr

-- Dumped from database version 16.13
-- Dumped by pg_dump version 17.10 (Debian 17.10-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tasks DROP CONSTRAINT IF EXISTS tasks_employer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_sessions DROP CONSTRAINT IF EXISTS task_sessions_worker_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_sessions DROP CONSTRAINT IF EXISTS task_sessions_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_sessions DROP CONSTRAINT IF EXISTS task_sessions_application_id_fkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_created_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.applications DROP CONSTRAINT IF EXISTS applications_worker_id_fkey;
ALTER TABLE IF EXISTS ONLY public.applications DROP CONSTRAINT IF EXISTS applications_task_id_fkey;
DROP INDEX IF EXISTS public.ix_withdrawal_requests_user_id;
DROP INDEX IF EXISTS public.ix_wallets_user_id;
DROP INDEX IF EXISTS public.ix_users_email;
DROP INDEX IF EXISTS public.ix_transactions_user_id;
DROP INDEX IF EXISTS public.ix_bank_accounts_user_id;
ALTER TABLE IF EXISTS ONLY public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_google_id_key;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.tasks DROP CONSTRAINT IF EXISTS tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.task_sessions DROP CONSTRAINT IF EXISTS task_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_pkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_pkey;
ALTER TABLE IF EXISTS ONLY public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_pkey;
ALTER TABLE IF EXISTS ONLY public.applications DROP CONSTRAINT IF EXISTS applications_pkey;
ALTER TABLE IF EXISTS ONLY public.alembic_version DROP CONSTRAINT IF EXISTS alembic_version_pkc;
DROP TABLE IF EXISTS public.withdrawal_requests;
DROP TABLE IF EXISTS public.wallets;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.tasks;
DROP TABLE IF EXISTS public.task_sessions;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.bank_accounts;
DROP TABLE IF EXISTS public.applications;
DROP TABLE IF EXISTS public.alembic_version;
DROP TYPE IF EXISTS public.taskstatus;
DROP TYPE IF EXISTS public.sessionstatus;
DROP TYPE IF EXISTS public.applicationstatus;
DROP EXTENSION IF EXISTS pgcrypto;
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: applicationstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.applicationstatus AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
);


--
-- Name: sessionstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sessionstatus AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'paused'
);


--
-- Name: taskstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.taskstatus AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    cover_note text,
    status public.applicationstatus NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    bank_name character varying(100) NOT NULL,
    account_number character varying(50) NOT NULL,
    account_holder_name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    body text NOT NULL,
    is_read boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reaction character varying(10),
    reply_to_id uuid
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    location character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_tag character varying(100)
);


--
-- Name: task_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_sessions (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    application_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_out_at timestamp with time zone,
    earnings double precision,
    status character varying(20) NOT NULL,
    proof_photo_url character varying(500),
    proof_notes text,
    rating double precision,
    feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid NOT NULL,
    employer_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    requirements text,
    location character varying(255) NOT NULL,
    latitude double precision,
    longitude double precision,
    pay_rate_per_minute double precision NOT NULL,
    estimated_duration_minutes integer NOT NULL,
    category character varying(100) NOT NULL,
    status public.taskstatus NOT NULL,
    max_applicants integer NOT NULL,
    starts_at timestamp with time zone,
    photo_url character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    company_tag character varying(100)
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    amount double precision NOT NULL,
    description character varying(500) NOT NULL,
    reference_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    google_id character varying(255),
    hashed_password character varying(255),
    profile_photo_url character varying(500),
    bio character varying(1000),
    location character varying(255),
    latitude double precision,
    longitude double precision,
    skills character varying(2000),
    fcm_token character varying(500),
    is_active boolean NOT NULL,
    is_employer boolean NOT NULL,
    is_admin boolean NOT NULL,
    is_verified boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    academic_qualification character varying(100),
    body_height_cm double precision,
    nationality character varying(100),
    race character varying(100),
    nric_passport character varying(50),
    phone character varying(20),
    phone_verified boolean DEFAULT false NOT NULL,
    bank_qr_code_url character varying(500),
    id_photo_front_url character varying(500),
    id_photo_back_url character varying(500),
    selfie_with_id_url character varying(500),
    verification_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    rejection_reason character varying(500),
    verification_submitted_at timestamp with time zone,
    is_super_admin boolean DEFAULT false NOT NULL,
    company_tag character varying(100)
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    available_balance double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount double precision NOT NULL,
    status character varying(20) NOT NULL,
    bank_name character varying(100) NOT NULL,
    account_number character varying(50) NOT NULL,
    account_holder_name character varying(255) NOT NULL,
    admin_notes text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
0009
\.


--
-- Data for Name: applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.applications (id, task_id, worker_id, cover_note, status, reviewed_at, created_at, updated_at) FROM stdin;
fed751a3-4d7b-41f3-9495-a0540cbe03e3	d0b553bf-c531-4561-8d65-df1b7fcc08f7	b2c1abec-95f6-442f-99af-0ce842aacfe2	I have experience of debugging an application before 	APPROVED	2026-05-08 01:43:11.547803+00	2026-05-08 01:38:40.784033+00	2026-05-08 01:43:11.531755+00
edaf4d3f-0719-4529-8771-617a6b548e88	4e330881-c380-4103-837e-0574a34290bb	b2c1abec-95f6-442f-99af-0ce842aacfe2		APPROVED	2026-05-08 02:06:16.341933+00	2026-05-08 02:06:05.405034+00	2026-05-08 02:06:16.331527+00
b0afb999-ce58-41ee-a77d-71280e1d4be0	d0b553bf-c531-4561-8d65-df1b7fcc08f7	0e34705e-59f0-4c48-b0e2-e70184163be1	experience with Windows system, have basic knowledge in C++, JavaScript and Python. 	APPROVED	2026-05-08 02:23:23.926958+00	2026-05-08 02:23:07.046688+00	2026-05-08 02:23:23.916182+00
60a834f9-bc1e-49ee-83b7-5d5275798864	780d55fb-8568-4a87-bc57-c01410cc8f96	0e34705e-59f0-4c48-b0e2-e70184163be1	Have bachelor's degree in mathematical modelling and analytics 	APPROVED	2026-05-18 02:29:10.860584+00	2026-05-18 02:28:50.639587+00	2026-05-18 02:29:10.854281+00
96ab35af-6a9e-4f08-82ad-a5742c386ef8	d4c92ce1-478d-439b-a575-bc8f406190ce	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-08 02:23:43.942372+00	2026-05-08 02:23:22.039808+00	2026-05-08 02:23:43.932433+00
f0c585e5-32ec-480e-a260-4e33dbd4affd	d0b553bf-c531-4561-8d65-df1b7fcc08f7	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-08 02:29:28.56198+00	2026-05-08 02:29:19.726053+00	2026-05-08 02:29:28.554166+00
26999319-1f47-45f7-91c1-47eb129d81a0	d4c92ce1-478d-439b-a575-bc8f406190ce	0e34705e-59f0-4c48-b0e2-e70184163be1		APPROVED	2026-05-08 02:46:52.780613+00	2026-05-08 02:46:40.931743+00	2026-05-08 02:46:52.774061+00
e83a7886-7822-4e84-8202-4d48dead3157	52be2535-24f2-4ad7-b7ff-fa2425898a27	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-08 03:13:30.794304+00	2026-05-08 03:13:23.595737+00	2026-05-08 03:13:30.78493+00
0e431b0c-0912-4069-ae7c-22c6094f35c3	52be2535-24f2-4ad7-b7ff-fa2425898a27	0e34705e-59f0-4c48-b0e2-e70184163be1	Have a motorcar, Have license	APPROVED	2026-05-10 04:11:01.922582+00	2026-05-10 04:10:47.86281+00	2026-05-10 04:11:01.914801+00
4f066d16-8368-41b2-9bea-2cb97c0ad231	b8ef25c0-117b-4cc5-80dd-d80c09e295bb	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-05-12 09:08:37.888015+00	2026-05-12 09:08:25.107335+00	2026-05-12 09:08:37.880572+00
eec800c3-e2da-4ec0-a1b2-584663d0948b	84099f46-76e9-4036-9ad9-19e328a5eda8	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-05-12 13:22:38.924651+00	2026-05-12 13:22:22.706314+00	2026-05-12 13:22:38.912391+00
13e711b9-e145-4dbc-a957-8a60cd7ee1df	ced5b375-ac3f-4ade-95f9-c0dbc6aadb51	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-05-12 13:48:05.797018+00	2026-05-12 13:47:58.232789+00	2026-05-12 13:48:05.78424+00
4a890d1b-017e-46c2-b640-86ec85ad2b79	25ae7e59-e3cc-4cec-b25a-d04d3938c936	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-05-13 08:56:49.234214+00	2026-05-13 08:56:37.392391+00	2026-05-13 08:56:49.222924+00
a3171e1b-46a4-496c-a565-b52d02d6d22e	b9f151c9-082f-4fb6-964d-68f05eb630f5	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-05-13 09:10:32.532548+00	2026-05-13 09:10:23.586935+00	2026-05-13 09:10:32.522881+00
d435c970-5cbb-48ea-848b-d3645d70d380	641ddf32-0e35-4848-94e6-23a58cf179d6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-15 01:29:33.662976+00	2026-05-15 01:29:14.509885+00	2026-05-15 01:29:33.652972+00
0288bc86-0399-4722-9453-62d3858e2b35	4053ebf1-2597-4d21-a3c3-695fe89d8f74	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-15 01:50:48.665518+00	2026-05-15 01:50:40.794383+00	2026-05-15 01:50:48.657598+00
eddc8e6a-d1c5-4271-841c-ec91037d60cf	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	0e34705e-59f0-4c48-b0e2-e70184163be1	Have license, Healthy 	APPROVED	2026-05-15 01:57:11.68021+00	2026-05-15 01:56:44.989981+00	2026-05-15 01:57:11.672557+00
4e7cc6f6-03ab-4230-ad7a-da4a64df7c68	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-15 01:57:19.714741+00	2026-05-15 01:57:10.76659+00	2026-05-15 01:57:19.709261+00
7cb43043-23af-46a9-b54d-76868a9c4586	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 01:57:37.383916+00	2026-05-15 01:55:34.546083+00	2026-05-15 01:57:37.377032+00
072434db-8422-4e26-ab30-d742a3796579	4e330881-c380-4103-837e-0574a34290bb	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 02:05:19.012173+00	2026-05-15 02:02:15.365554+00	2026-05-15 02:05:19.004766+00
c9937048-70a3-4bbb-8cf1-25ea9b6992dd	151a91ea-7221-4f06-b1cb-a901f3054207	0e34705e-59f0-4c48-b0e2-e70184163be1	Can Bake, Have apron, 	APPROVED	2026-05-15 02:11:35.817622+00	2026-05-15 02:11:25.6108+00	2026-05-15 02:11:35.810233+00
2c932cc4-3155-4b2a-8380-d380e0e959b4	0dd9ac7a-9b46-4fe7-b001-5af27af5be03	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 02:37:23.465811+00	2026-05-15 02:36:53.603124+00	2026-05-15 02:37:23.459739+00
4f51cfa7-6212-477e-b0fe-25ad6e668cfb	5103f24e-9fc0-468c-ae91-031ae30af2ca	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-15 02:38:55.057917+00	2026-05-15 02:38:44.916044+00	2026-05-15 02:38:55.051906+00
72be91d9-16e7-41a7-84a7-d81cf5d3dc58	ae2abc1b-7697-4549-a74e-7a723a11b8f3	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 02:46:20.893024+00	2026-05-15 02:46:00.183147+00	2026-05-15 02:46:20.886272+00
3c251b65-5549-4098-8484-298573dc657d	c5c15117-37b5-44b6-8928-843ac2710526	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 06:22:43.103183+00	2026-05-15 06:22:37.963201+00	2026-05-15 06:22:43.075347+00
e6ab62e5-168d-44cf-8833-984418db64c9	21876b78-4639-423f-8072-96cd5249a165	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-15 08:10:37.02566+00	2026-05-15 08:10:28.477477+00	2026-05-15 08:10:37.020505+00
1101df65-a10d-4cb4-bf01-b8998963e2f9	e541fd8d-f9f0-47ae-bed4-e053543f681f	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 01:09:06.998149+00	2026-05-18 01:09:00.586721+00	2026-05-18 01:09:06.98738+00
61802813-4154-4df1-b667-629523374e3d	5cb53a8d-f994-42eb-8434-66bd5affeeda	0e34705e-59f0-4c48-b0e2-e70184163be1	Have experience with macOS	APPROVED	2026-05-18 01:18:47.408474+00	2026-05-18 01:18:42.073772+00	2026-05-18 01:18:47.402095+00
1eb89440-8603-48c3-9deb-856ccb2d799f	30561113-6b83-4f0d-83fc-1ec9b397fe0c	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-18 01:35:50.434633+00	2026-05-18 01:35:28.616597+00	2026-05-18 01:35:50.42758+00
0cdc2eeb-1f88-4e04-ae2d-7a31a34ea491	27a29092-992e-4c32-a859-54249a1a7e8a	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 01:43:59.639116+00	2026-05-18 01:43:52.079936+00	2026-05-18 01:43:59.632188+00
ba656715-f284-468d-a64b-ac9e03252c5f	4d95b3e8-405b-4f50-b570-9581847f7118	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 01:44:00.79957+00	2026-05-18 01:43:48.150128+00	2026-05-18 01:44:00.794366+00
958ab6a5-618e-47b3-be2b-cbd5dfb2dd22	33abe8bf-cf82-4116-95ad-18e2762e4cb7	1d1be295-3305-4397-b9fb-dac021af69b0	I have experience in this	APPROVED	2026-05-18 01:47:29.149547+00	2026-05-18 01:45:04.68093+00	2026-05-18 01:47:29.141485+00
ee73d9d3-4f92-460b-ae71-11ca394d0d62	ef24b3be-86c4-4f2b-96f0-7e723358f363	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-05-18 02:11:47.179574+00	2026-05-18 02:11:34.613007+00	2026-05-18 02:11:47.173873+00
6926bcda-652a-48fe-a8f7-535d055647d5	47a1f317-53a8-4903-858a-eba3b1026e56	1d1be295-3305-4397-b9fb-dac021af69b0	I have the required degree	APPROVED	2026-05-18 06:18:13.761893+00	2026-05-18 02:37:09.531961+00	2026-05-18 06:18:13.753517+00
7ce1ea63-b26a-4442-a0ee-3ca2ae7adea2	bea0db2c-bc1d-48b7-b1f5-718133ba9a72	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 06:34:03.154774+00	2026-05-18 06:33:45.776536+00	2026-05-18 06:34:03.145085+00
f0b492d9-3511-45ed-b5fc-5b56e32fb2a0	e5d2b26e-48a5-4191-905a-318e259c551b	0e34705e-59f0-4c48-b0e2-e70184163be1	Have experience in cooking chicken chop 	APPROVED	2026-05-18 06:46:47.12311+00	2026-05-18 06:45:56.50276+00	2026-05-18 06:46:47.118302+00
69e03c1e-df59-4db1-8129-f6c58057974a	36eeaba9-bf3b-4bc4-b0ef-2e1df46ad613	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 07:07:58.311383+00	2026-05-18 07:07:50.971049+00	2026-05-18 07:07:58.305433+00
a4d21cf7-dca0-4e34-b3cb-5625cea1a0d2	a18f5eef-0748-4c12-a10d-65fc81653e40	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 07:16:45.817373+00	2026-05-18 07:16:39.186506+00	2026-05-18 07:16:45.813952+00
6441224c-58e7-4cc5-84df-5baff0ec614e	abeae079-83e1-403e-a1a1-7e8fba3921f3	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-18 07:56:22.112213+00	2026-05-18 07:56:15.238385+00	2026-05-18 07:56:22.105966+00
d3c7de86-41dd-4617-9c61-75077b40350c	61858d49-54d5-42d7-b2f9-4464ec0e8fdf	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-22 06:52:12.245371+00	2026-05-22 06:52:05.981417+00	2026-05-22 06:52:12.230296+00
8d930fcf-4376-4f7f-af2b-b47c8cd2cfc6	cec4404c-618c-4a38-a389-87da7b2f5e4d	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-22 07:09:47.793056+00	2026-05-22 07:09:42.852931+00	2026-05-22 07:09:47.786276+00
2497ec1d-cd73-4559-abb0-4692c6e67fa6	ace2ac19-19bd-496f-935a-bfa2382d3dbe	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-22 07:17:16.723273+00	2026-05-22 07:17:12.400149+00	2026-05-22 07:17:16.709689+00
f20c9d7a-20bb-4957-8d3e-623eeab21bb3	203b2323-bf14-4c4f-8c85-c227395a5962	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-05-22 07:57:52.049332+00	2026-05-22 07:57:35.290702+00	2026-05-22 07:57:52.044693+00
7dbe3bbc-e5c7-43d5-be27-eca56807eaaa	76a26938-619e-4a4b-8154-5cf76293497c	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-04 03:06:58.327748+00	2026-06-04 03:06:51.061281+00	2026-06-04 03:06:58.316538+00
3a9dfad7-1a31-4869-9235-5585a8f949d0	0f435d3e-3291-4f63-b794-e09a0a4029dc	1d1be295-3305-4397-b9fb-dac021af69b0	i have experiecne 	APPROVED	2026-06-04 03:19:08.738206+00	2026-06-04 03:19:02.673076+00	2026-06-04 03:19:08.732403+00
4ca1af31-033b-4114-8320-50393601aa21	7507176e-1403-4153-a6eb-ff87c9effa63	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-04 03:55:56.332974+00	2026-06-04 03:55:26.259296+00	2026-06-04 03:55:56.325592+00
d9d90e58-8ac6-468f-b698-b95ee4aba96a	0ffe0c1c-ae5c-4b3d-996b-42bfef0bd088	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-04 04:04:43.468685+00	2026-06-04 04:04:35.230981+00	2026-06-04 04:04:43.464668+00
e6f68f54-4019-438c-b536-0d16a1a1d2d3	ed306b07-1f3d-4d7d-b9e0-c0e856ba7f8a	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799		APPROVED	2026-06-04 06:14:11.396178+00	2026-06-04 06:14:00.101988+00	2026-06-04 06:14:11.388755+00
0cbcce99-eb20-4912-8a63-94df4b482275	ed306b07-1f3d-4d7d-b9e0-c0e856ba7f8a	0e34705e-59f0-4c48-b0e2-e70184163be1	HI	APPROVED	2026-06-04 06:15:02.631081+00	2026-06-04 06:14:42.722721+00	2026-06-04 06:15:02.62589+00
b7cf26ed-8ba0-4ede-9d83-51f93c4c65dc	9c46be04-759b-4c02-8c09-0a0e0baa3cc2	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-04 06:35:44.077983+00	2026-06-04 06:35:39.88046+00	2026-06-04 06:35:44.073091+00
cfc8fc1f-2774-4014-9b20-33da651088c6	2cba6f3b-9370-48eb-837c-54c8d1a384aa	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-06-07 03:52:35.695964+00	2026-06-07 03:52:10.938603+00	2026-06-07 03:52:35.688894+00
afc27ce4-3097-4186-a895-4dd93d2f3375	6e5ef224-e229-46e2-9d2b-15ac3ec1d054	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 07:46:26.890587+00	2026-06-10 07:46:19.398965+00	2026-06-10 07:46:26.885111+00
2d4ebe27-49d9-4a7c-9572-cddfc6cd3baf	51581b4c-6ec0-4a03-adb2-3be79875244a	fe9220e1-1e1d-43b3-864f-e65cec183c90		APPROVED	2026-06-07 04:11:25.372458+00	2026-06-07 04:11:16.774772+00	2026-06-07 04:11:25.339212+00
fc2e27c7-c3e6-417c-90e4-830b0eb673a5	82e328ee-42f1-4caf-bb18-b5b136e78a5b	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 07:32:38.409442+00	2026-06-10 07:32:28.903971+00	2026-06-10 07:32:38.392926+00
337a84d8-68ea-49b1-b050-e703c3884819	a9f98e44-6b5e-4e6e-a163-d2e8d76601f8	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 07:59:31.123553+00	2026-06-10 07:59:20.112939+00	2026-06-10 07:59:31.034667+00
d82ec91d-df36-4b6d-945e-c0325ba6c1db	ca82eb96-34d1-43ad-bc42-a30661bb02b7	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 08:05:23.836763+00	2026-06-10 08:05:10.362768+00	2026-06-10 08:05:23.828423+00
f1b4104d-3e91-4581-a4ea-3855decae38a	13a98f0a-a7ea-41d3-922b-7049302b2c3e	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 08:09:08.465212+00	2026-06-10 08:09:00.79912+00	2026-06-10 08:09:08.458646+00
1dbabff5-f1a4-4eca-9e20-bbb7b0125b70	52abd215-7c80-4fe8-8b30-391b67c2f2a2	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-10 08:14:53.77435+00	2026-06-10 08:14:48.932163+00	2026-06-10 08:14:53.767751+00
9e39b819-255b-4602-8bdb-cf4b1dd8d928	86edd7e3-4912-476e-ba56-b94f81914b9f	7e438196-958b-4cb5-831c-0027b8a009cb		APPROVED	2026-06-24 06:56:28.394557+00	2026-06-24 06:56:23.156439+00	2026-06-24 06:56:28.379821+00
1c4e3d96-3914-4b41-837f-0cf67debb0d1	fff30804-5762-4039-a8bf-c585d8fbb20d	7e438196-958b-4cb5-831c-0027b8a009cb		APPROVED	2026-06-24 07:03:16.160473+00	2026-06-24 07:03:09.033934+00	2026-06-24 07:03:16.12093+00
1804fcc4-e9e5-4d78-a9a4-e3908c9aa487	37fe1bcd-6cee-434f-8ea1-993ae6b9faa2	7e438196-958b-4cb5-831c-0027b8a009cb		APPROVED	2026-06-24 07:07:25.778691+00	2026-06-24 07:07:15.348602+00	2026-06-24 07:07:25.774157+00
09239866-94df-45f8-991f-2f790a8af2c1	7ec1de4b-ad98-4a6b-b945-50b1235c909c	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-06-24 07:38:25.38442+00	2026-06-24 07:38:18.506529+00	2026-06-24 07:38:25.374747+00
5d38068b-490d-4d1d-810d-5016d99d4647	dbeabfde-3496-4589-9868-3df960931496	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-06-24 07:44:45.990168+00	2026-06-24 07:43:48.844173+00	2026-06-24 07:44:45.985631+00
d89c1009-e407-481a-9b17-a58e1e25217e	bbdae445-6ded-441b-80e9-f023ac17f290	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-24 08:05:33.221439+00	2026-06-24 08:05:25.949367+00	2026-06-24 08:05:33.215849+00
9d95802f-2cd3-4384-9921-c569234f2b57	260071d4-3bdd-4e0d-ad17-cb272e94a21b	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-24 08:12:10.739863+00	2026-06-24 08:12:01.749214+00	2026-06-24 08:12:10.73316+00
1d5a2314-0e76-429e-a698-3b1a2dbd0205	5476870a-7dc2-4dca-b274-5c6430963887	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-24 08:17:53.721232+00	2026-06-24 08:17:46.100332+00	2026-06-24 08:17:53.715209+00
79a6ecdc-9289-481a-9d95-4980aa754e77	203b2323-bf14-4c4f-8c85-c227395a5962	7e438196-958b-4cb5-831c-0027b8a009cb		APPROVED	2026-07-10 01:08:32.388653+00	2026-05-22 08:06:05.964435+00	2026-07-10 01:08:32.371481+00
db4664e8-d500-48b5-b208-eb28f4477fb1	203b2323-bf14-4c4f-8c85-c227395a5962	0e34705e-59f0-4c48-b0e2-e70184163be1		APPROVED	2026-07-10 01:08:36.155852+00	2026-05-22 08:00:29.259652+00	2026-07-10 01:08:36.149969+00
aeb2a11f-6d55-45aa-99ea-29b67ea604b1	2251975a-557a-4e34-a5c4-7bfa41f9a179	067c11cc-f14f-439a-a673-c48b7b210aa1	Flexible time\nhave transportation\nexperience in cleaning	APPROVED	2026-06-25 04:23:46.450016+00	2026-06-25 04:23:25.326473+00	2026-06-25 04:23:46.442718+00
b4828f94-7799-4396-96fa-b63209bcb2ed	2251975a-557a-4e34-a5c4-7bfa41f9a179	1d1be295-3305-4397-b9fb-dac021af69b0	im good 	APPROVED	2026-06-25 04:27:36.337006+00	2026-06-25 04:27:23.020957+00	2026-06-25 04:27:36.328704+00
12527f86-1d78-45a2-b377-3cb64630acab	eae56c0f-e54d-42fb-a805-726cf0bedc32	067c11cc-f14f-439a-a673-c48b7b210aa1		APPROVED	2026-06-25 04:39:06.638944+00	2026-06-25 04:38:51.331624+00	2026-06-25 04:39:06.629542+00
d1e1268a-3448-4a6f-86d4-9ef0dbec2326	83056254-de14-4e73-978c-817a17d6953b	1d1be295-3305-4397-b9fb-dac021af69b0	H	APPROVED	2026-06-26 06:31:26.291299+00	2026-06-26 06:31:12.866952+00	2026-06-26 06:31:26.283436+00
ac212197-56a0-4728-9866-8b3c5780ce63	02c5f7cf-2c93-4890-a974-aea3b55c4bce	1d1be295-3305-4397-b9fb-dac021af69b0		APPROVED	2026-06-26 06:42:56.176895+00	2026-06-26 06:42:49.286279+00	2026-06-26 06:42:56.168675+00
1dc41b70-bb45-4501-a0f8-0e5564b745aa	b76b9fc1-d6af-4328-a0c4-fbb6addcd431	a5ed9b09-88c3-453f-8db1-75e8773a7344		APPROVED	2026-07-06 13:02:47.272467+00	2026-07-06 13:02:25.242652+00	2026-07-06 13:02:47.263373+00
8b2f9387-1a69-4fbb-b546-fe693689ce27	f80cc3a4-4dfd-47f6-b57f-d4dce3bf0b96	a5ed9b09-88c3-453f-8db1-75e8773a7344		APPROVED	2026-07-06 13:04:24.890231+00	2026-07-06 13:04:15.01067+00	2026-07-06 13:04:24.864857+00
fe05192d-cf79-4830-924b-080b2481ee97	35d43768-a605-4bac-82f5-2e7029e916b8	923dd663-1a82-4bf0-bc98-f91289dd3ce4		APPROVED	2026-07-06 14:23:23.55069+00	2026-07-06 14:23:10.117942+00	2026-07-06 14:23:23.546706+00
f30cf089-c88f-49a3-85d7-2bb94740306d	35d43768-a605-4bac-82f5-2e7029e916b8	f2c26e4f-30c3-4618-a4b6-0771590958b7		APPROVED	2026-07-07 14:35:13.420228+00	2026-07-07 14:34:56.15171+00	2026-07-07 14:35:13.40802+00
c9a424bc-5046-47c3-9a0a-51ce17ee46df	b050ceb2-95b8-4122-bba0-bb44d33d4c6a	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-07-08 01:39:34.784598+00	2026-07-08 01:39:13.916017+00	2026-07-08 01:39:34.775756+00
807a0395-2149-4cd5-b96e-0d48d3a9fc54	0611dc85-77bc-449d-ba62-9c3855f45be5	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-07-08 01:39:37.153747+00	2026-07-08 01:39:07.407092+00	2026-07-08 01:39:37.146186+00
1b7c555d-f98f-42f9-9207-8dbc31c75a09	7b6c6c28-070b-4218-b4c3-1e40fbff59a1	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-07-10 07:45:38.173629+00	2026-07-10 07:44:50.450116+00	2026-07-10 07:45:38.162006+00
3a5f77ea-04de-4d09-ae88-8c6a161cc32a	a43ed828-7a42-48b7-97bb-516963c7efad	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-07-10 07:57:17.862048+00	2026-07-10 07:57:05.370613+00	2026-07-10 07:57:17.851968+00
33690eac-8e2a-46c2-a65c-baba21421fac	8cf9d55c-d09a-4128-8f28-759ef651037a	e57f811f-ddfd-406f-8050-bedf7bdacd10	mmm	APPROVED	2026-07-10 13:31:12.451889+00	2026-07-10 13:30:46.260963+00	2026-07-10 13:31:12.432385+00
ea90f72b-395f-4ffd-b797-f4a4f0375dd0	d97993ae-0b13-492a-a5ed-ff728ec354f3	e57f811f-ddfd-406f-8050-bedf7bdacd10		APPROVED	2026-07-10 13:35:07.313175+00	2026-07-10 13:35:01.329356+00	2026-07-10 13:35:07.299154+00
b7e6e96f-9ce9-471e-acc1-c340419b8b09	630f3f60-d74f-48cb-a37c-0a2e7af2e7b6	2c9fb196-b062-42f1-9894-e7178ea038f6		APPROVED	2026-07-10 13:42:57.82739+00	2026-07-10 13:42:53.209069+00	2026-07-10 13:42:57.819506+00
a33dcbdb-6277-4fc3-90cb-a2b71acee15e	a48cbcff-3b1b-405b-911d-50c7a5d545c7	e57f811f-ddfd-406f-8050-bedf7bdacd10		APPROVED	2026-07-10 13:43:53.873209+00	2026-07-10 13:43:45.484631+00	2026-07-10 13:43:53.867498+00
3f558328-60c0-4064-808a-8471a6bff0a3	34c5eab5-c49b-448a-aa9a-a5258c07fc27	e57f811f-ddfd-406f-8050-bedf7bdacd10		APPROVED	2026-07-10 13:46:58.377643+00	2026-07-10 13:43:10.769871+00	2026-07-10 13:46:58.362463+00
\.


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bank_accounts (id, user_id, bank_name, account_number, account_holder_name, created_at, updated_at) FROM stdin;
de8ca9e2-b397-4530-a087-1ae02b8834ee	0e34705e-59f0-4c48-b0e2-e70184163be1	FarhanBank	1234567890123456	Farhan	2026-05-08 03:00:56.863722+00	2026-05-08 03:02:26.580169+00
91fcbb98-400d-4346-8b35-6354028853b2	b2c1abec-95f6-442f-99af-0ce842aacfe2	EmioBankBerhad	123456789012	EMIO 	2026-05-08 03:14:52.830555+00	2026-05-08 03:40:53.205641+00
30ba691e-dbaa-41d9-bce9-54e20fd4c990	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	Bank	1000	1000	2026-05-15 03:00:58.062878+00	2026-05-15 03:00:58.062878+00
def1bba5-4991-4281-ba01-995fefdf49a9	fe9220e1-1e1d-43b3-864f-e65cec183c90	Maybank	107022406756	Tan Eng Hoo	2026-05-19 13:45:12.435049+00	2026-05-19 13:45:12.435049+00
85aa2a32-6354-4d53-bf04-bf38381dfa74	7e438196-958b-4cb5-831c-0027b8a009cb	CIMB Bank	12345678912345	Emi	2026-06-24 06:51:19.252811+00	2026-06-24 06:51:19.252811+00
03793b00-f830-400f-a2a9-2241b6c6646b	2c9fb196-b062-42f1-9894-e7178ea038f6	Maybank	123456789012	hy	2026-06-24 07:42:36.547175+00	2026-06-24 07:42:36.547175+00
383230e0-4caa-4057-befd-259e152d4f83	067c11cc-f14f-439a-a673-c48b7b210aa1	Maybank	123456789012	henria	2026-06-25 04:41:38.549386+00	2026-06-25 04:41:38.549386+00
033a1263-d8a2-424b-8b9e-b07b7940c6b8	1d1be295-3305-4397-b9fb-dac021af69b0	Hong Leong Bank	123412341234	Emio	2026-05-15 08:07:39.282031+00	2026-06-25 07:57:02.169364+00
88073443-29d1-4a4d-b758-9751b5bcadbe	a5ed9b09-88c3-453f-8db1-75e8773a7344	CIMB Bank	12341234123412	CMB	2026-07-06 13:07:27.129286+00	2026-07-06 13:07:27.129286+00
5341cda8-b4cb-440c-986b-b03d5639f1a6	e57f811f-ddfd-406f-8050-bedf7bdacd10	Public Bank	1111111111	jt	2026-07-10 13:39:38.829579+00	2026-07-10 13:39:38.829579+00
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, sender_id, recipient_id, body, is_read, created_at, reaction, reply_to_id) FROM stdin;
fd678a27-1255-4484-b533-5f9a6ab85c3c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	b2c1abec-95f6-442f-99af-0ce842aacfe2	hello syed,	f	2026-05-08 01:39:01.503348+00	\N	\N
a00d394b-9265-4f3a-b704-da6345ec1cde	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	test	t	2026-05-12 05:39:07.808285+00	\N	\N
83f7549e-9cfc-44f2-9663-748af72db361	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	hello	t	2026-05-12 05:39:25.749911+00	\N	\N
39e593b8-90cd-423f-aadd-1b6381f6cc01	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	123	t	2026-05-12 08:50:20.902996+00	\N	\N
5fe9c6ee-7410-4a63-80fd-82659ab8cbb1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	test	t	2026-05-08 02:24:14.38476+00	\N	\N
a59316f1-adbe-4213-ba2c-fbc6c1180212	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	hello	t	2026-05-07 07:42:35.219165+00	\N	\N
7162d34b-a165-4b9b-ab84-53c424994a7f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	hi how working	t	2026-05-15 01:34:04.256067+00	\N	\N
1b1fb131-1962-4a0c-90a9-8ac4d17c8106	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	Hello!!!	t	2026-05-07 08:00:09.130083+00	\N	\N
6a605629-834d-4a90-9c56-5e022f736091	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	haiii	t	2026-05-07 08:09:53.142503+00	\N	\N
77066ef0-00e2-41e0-b275-e11d92dec22a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	✅ Your withdrawal of RM 0.01 has been approved and transferred to FarhanBank ···3456. Please allow 1-3 business days.	t	2026-05-10 03:15:30.139247+00	\N	\N
86736dc6-f95f-4372-8772-c95d2ee0da02	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	✅ Your withdrawal of RM 10.00 has been approved and transferred to FarhanBank ···3456. Please allow 1-3 business days.	t	2026-05-10 04:07:47.579471+00	\N	\N
8bad5838-9db4-46e9-9b61-3b94ba0732de	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	⏱ Your work session time was adjusted by an admin. New earnings: RM 12.00. Reason: Did not have proof of completion	t	2026-05-10 04:35:42.323673+00	\N	\N
d3aabed3-5729-449c-85da-533fa9ad0b2b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	Hai emio (test)	t	2026-05-15 01:31:56.183043+00	\N	\N
214898dd-5a29-4496-9dd2-df4fbc5e2e44	1d1be295-3305-4397-b9fb-dac021af69b0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	hello	t	2026-05-15 02:18:06.939366+00	\N	\N
df0802f8-faa5-4dad-b6c3-83d994534277	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	ok	t	2026-05-15 02:19:56.843493+00	\N	\N
72b70f2f-42ce-42ea-8106-5d1acf627f68	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	❌ Your withdrawal of RM 1700.00 was rejected and has been refunded to your wallet.	t	2026-05-15 02:25:18.179701+00	\N	\N
e98c96f1-cd53-4ebb-8b2d-07a9b6938798	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	✅ Your withdrawal of RM 1700.00 has been approved and transferred to FarhanBank ···3456. Please allow 1-3 business days.	t	2026-05-15 02:26:24.021521+00	\N	\N
4dc3c50a-77ee-4892-b719-63f13a752055	9c554cda-b937-4784-a17f-74ddf17fd953	270c7ae3-e598-4333-9e6f-880d8faf4d6a	hello	f	2026-05-16 04:42:35.785969+00	\N	\N
7c9af964-901b-4a01-b6a4-86fa14ee2d56	9c554cda-b937-4784-a17f-74ddf17fd953	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ABC	t	2026-05-16 04:42:45.535994+00	\N	\N
3a3f1632-5d2a-4d09-b0e8-f3f01e3c7b73	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 12.00 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-05-15 08:34:42.91613+00	\N	\N
dade6582-7efa-400a-a281-7d3fcfd5111f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	✅ Your withdrawal of RM 10.00 has been approved and transferred to Bank ···1000. Please allow 1-3 business days.	t	2026-05-15 03:02:01.950231+00	\N	\N
a5d134c4-f4f2-4af6-b6d9-1fd59797c6ea	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	How are the job currently	t	2026-05-18 01:41:04.822607+00	\N	\N
fbd715b8-556b-4a9d-ad0f-ff076a890b53	0e34705e-59f0-4c48-b0e2-e70184163be1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Its okay	t	2026-05-18 01:41:28.810447+00	\N	\N
d82d4e03-2660-4552-9ec3-5215c2053755	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	Hello syed, are you confident of your ability to clean the office	t	2026-05-18 01:45:49.26829+00	\N	\N
25aba3d3-2359-4092-9deb-40d6ab63a82e	1d1be295-3305-4397-b9fb-dac021af69b0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	yes im confident and ready to work	t	2026-05-18 01:46:31.807739+00	\N	\N
25041d4c-b66d-413f-beaf-b6df9cc27c73	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	okay the goodluck	t	2026-05-18 01:47:40.821867+00	\N	\N
77fc76ed-0372-493f-83f9-aa05fda34b80	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 16.00 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-05-18 02:17:10.538945+00	\N	\N
f2d893a3-6b6b-4488-83d5-76160fb7c5e7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	goodluck	t	2026-05-18 06:18:09.307313+00	\N	\N
dcbd98aa-8b44-419a-9e4e-5607d94e0e7e	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	✅ Your withdrawal of RM 1000.00 has been approved and transferred to FarhanBank ···3456. Please allow 1-3 business days.	t	2026-05-18 06:51:54.128703+00	\N	\N
3e67f266-0022-4852-8070-750d6502c6ce	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	❌ Your withdrawal of RM 100.00 was rejected and has been refunded to your wallet.	t	2026-05-18 06:58:37.836221+00	\N	\N
eb6a62b4-953a-4a07-a91c-1b6609cb07ed	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	❌ Your withdrawal of RM 100.00 was rejected and has been refunded to your wallet.	t	2026-05-18 06:57:31.407931+00	\N	\N
e7b1b99d-726e-4245-8720-f94d96ac0bf2	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 15.09 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-05-18 06:50:12.037552+00	\N	\N
73e322a8-8aef-468e-accd-e4802cde6352	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 20.00 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-05-18 07:52:15.34202+00	\N	\N
0711e72d-5497-4b0e-a296-bc737184df33	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	HELLO	t	2026-05-22 07:43:44.991465+00	\N	\N
ec458692-841f-436c-beba-7237502810da	1d1be295-3305-4397-b9fb-dac021af69b0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	YES	t	2026-05-22 07:44:05.769052+00	\N	\N
e709584c-885b-4434-acf2-d8e1572ba03f	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 345	t	2026-05-19 13:39:07.7315+00	\N	\N
9660aac8-cc89-4142-9c76-c855b9a5dc01	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 1	t	2026-05-26 13:19:19.557448+00	\N	\N
ab787022-6a09-41ef-bad7-d1542027b6b1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 1	t	2026-05-26 13:19:38.836394+00	\N	\N
8d323f17-d5c8-471e-9b77-6ca155f3705d	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 2	t	2026-05-26 13:25:56.864553+00	\N	\N
7d479e60-08c6-45eb-95ac-e644683c9ec5	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 2	t	2026-05-26 13:26:39.540207+00	\N	\N
5660f52c-abdb-4eef-8af2-c42a80360ac3	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 3	t	2026-05-26 13:40:29.407338+00	\N	\N
e0d462b4-6aca-4ae6-a402-b2fd91f7a043	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 3	t	2026-05-26 13:41:03.913827+00	\N	\N
2cae6e49-adb8-4229-8eb0-196a777456b5	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 4	t	2026-05-26 13:51:00.759406+00	\N	\N
7b685726-81ad-4572-9939-4c135cf28f2c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 4	t	2026-05-26 13:51:36.289009+00	\N	\N
aaa44a76-aee7-4355-b205-2378f6eddbc2	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 6	t	2026-05-26 14:01:11.308908+00	\N	\N
fce6040f-79ba-47fb-b6cf-fee80fc54993	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 5	t	2026-05-26 13:52:39.062913+00	\N	\N
d214feec-e183-4684-8575-f3c6eac710f1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 5	t	2026-05-26 14:01:40.706554+00	\N	\N
e02f1fa9-ca5c-44d4-989d-f8cf62f70002	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 6	t	2026-05-26 14:01:50.205265+00	\N	\N
0fcc5e91-0b9f-4eae-83ab-fd5fd35a18e3	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	ack 7	t	2026-05-26 14:05:14.319567+00	\N	\N
8f22c440-b670-41fe-ab55-6abd101b8ea6	fe9220e1-1e1d-43b3-864f-e65cec183c90	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testing 7	t	2026-05-26 14:04:57.342752+00	\N	\N
5a23c449-a6f8-4e9b-9d04-6513a7f42d45	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	hai	t	2026-05-22 08:03:49.209292+00	\N	\N
c120b1f5-dc18-41fc-bf6a-4667bfd14ef0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	farhan are u available now	t	2026-05-22 08:04:08.796251+00	\N	\N
eafa0295-1b2f-4adb-9b6d-f95e813320d2	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	b2c1abec-95f6-442f-99af-0ce842aacfe2	⚠️ Your active session for "Office Cleaning" was stopped by an admin. You have been credited RM 17392.81 for 34786 minutes worked.	f	2026-06-04 03:58:44.925902+00	\N	\N
82fc47b8-8ecc-4043-9ade-c76fb2c9c3b8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	test69	t	2026-06-04 04:15:36.423237+00	\N	\N
f20fb3fd-1484-42c6-a80a-b8789afc17c4	1d1be295-3305-4397-b9fb-dac021af69b0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ok	t	2026-06-04 04:15:47.200766+00	\N	\N
94be0668-86b9-44e9-a524-ac60c2cd4658	1d1be295-3305-4397-b9fb-dac021af69b0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ok	t	2026-06-04 04:16:22.29694+00	\N	\N
2a566f72-ae13-45aa-bd6d-72989e44b104	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	ok	t	2026-06-04 04:20:36.36054+00	\N	\N
898dc452-ad12-4a39-ba5d-76a17ca8bc42	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	❌ Your withdrawal of RM 50.00 was rejected and has been refunded to your wallet.	t	2026-06-04 06:16:48.887552+00	\N	\N
86a8a0d9-fb0b-4440-ba63-879618885ebf	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	⚠️ Your active session for "TEST" was stopped by an admin. You have been credited RM 7677.69 for 8725 minutes worked.	f	2026-06-10 07:45:29.207602+00	\N	\N
753e494c-4ea5-45a3-bcec-6332cc720ffd	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	⚠️ Your active session for "Cook Chicken Chop" was stopped by an admin. You have been credited RM 24311.47 for 24311 minutes worked.	t	2026-06-04 03:58:51.499181+00	\N	\N
6c74b5fa-994d-4c13-a765-6e8c12f571d0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	7e438196-958b-4cb5-831c-0027b8a009cb	✅ Your withdrawal of RM 10.00 has been approved and transferred to CIMB Bank ···2345. Please allow 1-3 business days.	t	2026-06-24 07:06:12.352587+00	\N	\N
dbe5ad67-333d-4025-b49a-52c132b3971c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	7e438196-958b-4cb5-831c-0027b8a009cb	✅ Your withdrawal of RM 10.00 has been approved and transferred to CIMB Bank ···2345. Please allow 1-3 business days.	t	2026-06-24 07:06:32.019063+00	\N	\N
4cc046be-7c02-4e3d-ad55-8b5685e4f33e	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	7e438196-958b-4cb5-831c-0027b8a009cb	❌ Your withdrawal of RM 20.00 was rejected and has been refunded to your wallet.	f	2026-06-24 07:11:34.096369+00	\N	\N
4f7d541a-c6e0-45a7-b7a9-53b84b9fba05	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your withdrawal of RM 1000.00 has been approved and transferred to Maybank ···9012. Please allow 1-3 business days.	t	2026-06-24 07:42:54.168513+00	\N	\N
a794ea16-cd2c-4c09-8888-4ca1e4513408	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	067c11cc-f14f-439a-a673-c48b7b210aa1	❌ Your withdrawal of RM 10.00 was rejected and has been refunded to your wallet. Reason: fake	t	2026-06-25 04:42:37.974233+00	\N	\N
f02e9f1f-9a72-4df6-adad-d30cc2f9fa98	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	067c11cc-f14f-439a-a673-c48b7b210aa1	hahaha kena reject payment hhhh	f	2026-06-25 06:42:43.338664+00	\N	\N
c2998a1d-e658-40ab-8bfd-29e3d7913f1a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 1000.00 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-06-24 08:11:04.48663+00	\N	\N
e8459c52-5ebf-4e9e-a47d-fda803504bd8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	⚠️ Your active session for "tt" was stopped by an admin. You have been credited RM 1209.53 for 1344 minutes worked.	t	2026-06-25 06:42:23.995351+00	\N	\N
b42f4396-15ac-4464-911f-0585ee153aad	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	⚠️ Your active session for "data collection at MW " was stopped by an admin. You have been credited RM 2.79 for 17 minutes worked.	t	2026-06-25 07:02:38.346211+00	\N	\N
11779881-2524-41ec-9973-a5ee4bdf7b4e	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 119.00 has been approved and transferred to Hong Leong Bank ···1234. Please allow 1-3 business days.	t	2026-06-25 08:00:11.393382+00	\N	\N
4a8cf9bd-d0f4-4c73-ba61-ea65dfcad6f6	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 100.00 has been approved and transferred to qejobnjld ···1010. Please allow 1-3 business days.	t	2026-06-25 07:56:04.319495+00	\N	\N
e1e48e4a-89d2-496d-b434-576ca96cc4f5	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 119.00 has been approved and transferred to Hong Leong Bank ···1234. Please allow 1-3 business days.	t	2026-06-25 07:57:59.514933+00	\N	\N
10501a08-8102-4079-b110-1cad8e8404f3	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	❌ Your withdrawal of RM 100.00 was rejected and has been refunded to your wallet. Reason: NEED to contsact admin	f	2026-06-26 06:39:09.113955+00	\N	\N
83b46583-5584-4d7d-b684-4e2618c5d5cd	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your withdrawal of RM 10.00 has been approved and transferred to Hong Leong Bank ···1234. Please allow 1-3 business days.	f	2026-06-26 06:39:41.506706+00	\N	\N
1501b58b-0fb9-4bbb-a608-7ae0c779e783	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your withdrawal of RM 38000.00 has been approved and transferred to Maybank ···9012. Please allow 1-3 business days.	t	2026-06-26 07:31:37.427293+00	\N	\N
f6b125c9-7b64-4f74-9ade-c5ae787c1f94	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	a5ed9b09-88c3-453f-8db1-75e8773a7344	✅ Your withdrawal of RM 50.00 has been approved and transferred to CIMB Bank ···3412. Please allow 1-3 business days.	t	2026-07-06 13:07:43.193194+00	\N	\N
72ce4040-354b-4043-b1b3-b3cc1b4646cb	a5ed9b09-88c3-453f-8db1-75e8773a7344	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	thanks	f	2026-07-06 13:07:58.946738+00	\N	\N
ae629f2c-fb1a-465f-9b7e-b16f924a6b8b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	fe9220e1-1e1d-43b3-864f-e65cec183c90	✅ Your withdrawal of RM 10.00 has been approved and transferred to Maybank ···6756. Please allow 1-3 business days.	t	2026-06-25 04:15:32.148742+00	\N	\N
a643b855-3f3b-4eaf-b013-df06f9d75f2d	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	7e438196-958b-4cb5-831c-0027b8a009cb	✅ Your application for "test" has been approved! You can now check in and start tracking your work.	f	2026-07-10 01:08:32.371481+00	\N	\N
54c67beb-7984-46ad-8704-c8ba97554666	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	⚠️ Your active session for "test2" was stopped by an admin. You have been credited RM 2.02 for 2 minutes worked.	t	2026-07-10 01:23:12.685673+00	\N	\N
79ff3eba-5050-48db-9058-e8957dd82487	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your withdrawal of RM 10.00 has been approved and transferred to Maybank ···9012. Please allow 1-3 business days.	t	2026-07-10 01:19:53.299751+00	\N	\N
e4e9fbb6-a0f5-431c-b907-524a5731550a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your task "test" has been approved! RM 1.40 has been credited to your wallet.	t	2026-07-10 01:19:20.652566+00	\N	\N
f17b06db-e1b6-4ff2-84f7-8da5b3b56d4f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c2cee8d-4429-4931-897f-0b398427e40a	✅ Your account has been verified! You can now apply for tasks and start earning.	t	2026-07-10 01:27:48.761218+00	\N	\N
e4b0006b-bc08-4cd7-afaa-8b5fa394e796	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your task "data collection " has been approved! RM 0.10 has been credited to your wallet.	t	2026-07-10 07:58:58.502208+00	\N	\N
84ffee2c-43ac-4fed-b78b-daed15ae03a2	e57f811f-ddfd-406f-8050-bedf7bdacd10	270c7ae3-e598-4333-9e6f-880d8faf4d6a	help	f	2026-07-10 13:21:04.338098+00	\N	\N
b5ff6efc-9f02-479b-8133-14dfae4f8bbd	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	f2c26e4f-30c3-4618-a4b6-0771590958b7	❌ Your task "Arranging goods to the rack" was not approved. Please contact support for more details.	f	2026-07-10 13:22:52.475547+00	\N	\N
d7021e13-e7d1-4282-bf30-2ac96e25e457	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	a5ed9b09-88c3-453f-8db1-75e8773a7344	✅ Your task "dejkkncje" has been approved! RM 50.00 has been credited to your wallet.	f	2026-07-10 13:22:56.635742+00	\N	\N
3af23923-fab1-4efd-a166-f26a10751952	2c2cee8d-4429-4931-897f-0b398427e40a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	welcoem	t	2026-07-10 01:30:31.66367+00	😮	\N
b74b108f-bb08-4641-b820-d256bc048ae9	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c2cee8d-4429-4931-897f-0b398427e40a	Thanks for your message! We'll review and get back to you.	t	2026-07-10 01:30:18.650697+00	😢	\N
6da37749-16dd-4a06-b8ce-eaa3e9900475	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	✅ Your task "test" has been approved! RM 0.50 has been credited to your wallet.	f	2026-07-10 13:23:01.881351+00	\N	\N
ed27f4ec-944e-4db3-886f-80b090209532	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your task "test2" has been approved! RM 2.02 has been credited to your wallet.	t	2026-07-10 01:24:46.548109+00	\N	\N
f3d3bb80-ebd9-4b5a-817a-bb5edc6421f7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your application for "a" has been approved! You can now check in and start tracking your work.	t	2026-07-10 07:45:38.162006+00	\N	\N
bf4373a5-f33d-4d11-88ae-05c216a19606	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your task "a" has been approved! RM 0.07 has been credited to your wallet.	t	2026-07-10 07:47:01.909615+00	\N	\N
9045bbaf-5f43-4f4a-8cdb-bab5cbd5ae64	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	❌ Your withdrawal of RM 11.00 was rejected and has been refunded to your wallet.	t	2026-07-10 07:48:45.647167+00	\N	\N
7ee74788-8f9f-4a78-a76d-a841073c1194	2c9fb196-b062-42f1-9894-e7178ea038f6	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	t	2026-07-10 07:55:52.134316+00	\N	\N
53fcd4c3-6651-4f61-ac59-7860e4bd8274	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your application for "data collection " has been approved! You can now check in and start tracking your work.	t	2026-07-10 07:57:17.851968+00	\N	\N
dca62406-8ff1-497b-a38f-c9c77b82a2b7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2c9fb196-b062-42f1-9894-e7178ea038f6	⚠️ Your active session for "data collection " was stopped by an admin. RM 0.10 has been recorded and is pending approval from the session approval page.	t	2026-07-10 07:58:09.491098+00	\N	\N
f72d2b7d-62c4-45a2-a097-87a6ccb1e2e7	e57f811f-ddfd-406f-8050-bedf7bdacd10	270c7ae3-e598-4333-9e6f-880d8faf4d6a	hiiii	f	2026-07-10 13:24:06.385923+00	\N	\N
d7acbfa4-c872-4d5e-a83e-6883ed9bcc6e	e57f811f-ddfd-406f-8050-bedf7bdacd10	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	hiiii	t	2026-07-10 13:24:30.473181+00	\N	\N
266ede59-e7e4-4531-8a71-4359d75985e0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	e57f811f-ddfd-406f-8050-bedf7bdacd10	helppppppp	t	2026-07-10 13:24:38.983953+00	\N	\N
a8d5d69f-6367-438b-a3b3-5d74f7e21027	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your application for "MW C DC" has been approved! You can now check in and start tracking your work.	t	2026-07-10 13:31:12.432385+00	\N	\N
3d027d57-917a-4a9f-a1ed-4b31f4de1243	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	e57f811f-ddfd-406f-8050-bedf7bdacd10	Please provide more details about the task.	t	2026-07-10 13:25:07.695463+00	\N	\N
d7ebe8bf-2094-4345-b549-52c76f0badc6	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your task "MW C DC" has been approved! RM 0.01 has been credited to your wallet.	t	2026-07-10 13:33:25.774176+00	\N	\N
0444a91d-3900-4041-ab3a-b6c8e005ec57	e57f811f-ddfd-406f-8050-bedf7bdacd10	24d9a86a-879f-4d18-a08c-2ee915c11b58	ok	t	2026-07-10 13:31:21.654043+00	\N	\N
26d5cf96-aa0e-4cc9-b68f-0ac8466e7954	4e252a5b-389f-4648-933c-e95b5fc99f40	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your application for "abc" has been approved! You can now check in and start tracking your work.	f	2026-07-10 13:42:57.819506+00	\N	\N
eb573677-e497-4551-9e77-c08859bd11c5	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	1d1be295-3305-4397-b9fb-dac021af69b0	test 123	f	2026-07-10 13:47:39.689648+00	\N	\N
4376a266-b744-4125-9eb7-612f1a875c61	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	✅ Your application for "test" has been approved! You can now check in and start tracking your work.	t	2026-07-10 01:08:36.149969+00	\N	\N
eda42373-65f3-4836-b574-5a3073d258fa	4e252a5b-389f-4648-933c-e95b5fc99f40	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your task "abc" has been approved! RM 0.01 has been credited to your wallet.	f	2026-07-10 13:43:18.363254+00	\N	\N
cacaa5e4-fd0e-402a-91d3-df07dfe17e7d	4e252a5b-389f-4648-933c-e95b5fc99f40	2c9fb196-b062-42f1-9894-e7178ea038f6	✅ Your withdrawal of RM 10.00 has been approved and transferred to Maybank ···9012. Please allow 1-3 business days.	f	2026-07-10 13:43:40.796442+00	\N	\N
dc4ff56a-cfb1-4872-8c0c-61375274fa65	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your task "kk" has been approved! RM 678.00 has been credited to your wallet.	t	2026-07-10 13:45:19.860297+00	\N	\N
6f42b666-934b-46b9-b953-ac64c6dd0ce9	4e252a5b-389f-4648-933c-e95b5fc99f40	2c9fb196-b062-42f1-9894-e7178ea038f6	hi	f	2026-07-10 13:43:55.223543+00	\N	\N
2a9a3d79-275c-476f-8847-0018326369a9	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your withdrawal of RM 1000.00 has been approved and transferred to Public Bank ···1111. Please allow 1-3 business days.	t	2026-07-10 13:39:56.909184+00	\N	\N
45aaad42-c2ba-4bd9-bf81-23cb7c19bc20	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your task "tc" has been approved! RM 1720.00 has been credited to your wallet.	t	2026-07-10 13:39:08.276328+00	\N	\N
4dee4476-50b0-42b5-95e7-ea98d1cb17a2	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your application for "kk" has been approved! You can now check in and start tracking your work.	t	2026-07-10 13:43:53.867498+00	\N	\N
67045bd9-5562-48d1-83be-db2b73c511f1	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your application for "tc" has been approved! You can now check in and start tracking your work.	t	2026-07-10 13:35:07.299154+00	\N	\N
80ed4770-8740-479a-91db-8bbb7ab0c9fe	24d9a86a-879f-4d18-a08c-2ee915c11b58	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your task "tc" has been approved! RM 0.01 has been credited to your wallet.	t	2026-07-10 13:36:28.307328+00	\N	\N
b106cc53-5b83-4969-acc0-92d2554f57bb	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	e57f811f-ddfd-406f-8050-bedf7bdacd10	✅ Your application for "add" has been approved! You can now check in and start tracking your work.	t	2026-07-10 13:46:58.362463+00	\N	\N
f0dba22c-3165-4cc6-94a6-0eeeb69fd864	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	e27a490d-fbfa-407b-9a85-fa628f5a8495	✅ Your account has been verified! You can now apply for tasks and start earning.	f	2026-07-10 13:53:08.047252+00	\N	\N
ad80cde7-7482-4260-bfd6-c2777a5e5304	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0e34705e-59f0-4c48-b0e2-e70184163be1	Hi Farhan\\	t	2026-07-13 01:35:50.324189+00	\N	\N
e441bac2-6172-489f-991b-93a75945111f	0e34705e-59f0-4c48-b0e2-e70184163be1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Hi Admin	t	2026-07-13 01:36:21.803699+00	\N	\N
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, category, location, status, created_by_id, created_at, updated_at, company_tag) FROM stdin;
1f1c28c4-e447-4df6-9a9c-fa5b4e93e6c7	AI PROJECT	\N	Other	PENANG	active	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2026-07-10 02:07:10.848266+00	2026-07-10 02:07:10.848266+00	\N
3589f24c-0740-4e40-8fbc-0d425303c977	a	a	Events	a	active	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	2026-07-10 13:27:36.214543+00	2026-07-10 13:27:36.214543+00	\N
d7e69a73-bc94-4eae-9b67-07640116a64b	EGO Data Collection 1	cleaning	Cleaning	Puchong	active	24d9a86a-879f-4d18-a08c-2ee915c11b58	2026-07-10 13:28:12.478995+00	2026-07-10 13:28:12.478995+00	MW
54e92380-d479-41d5-b8dc-bed30fe22003	BHP research project	\N	\N	\N	active	4e252a5b-389f-4648-933c-e95b5fc99f40	2026-07-10 13:42:19.379084+00	2026-07-10 13:42:19.379084+00	BHP
\.


--
-- Data for Name: task_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_sessions (id, task_id, worker_id, application_id, checked_in_at, checked_out_at, earnings, status, proof_photo_url, proof_notes, rating, feedback, created_at) FROM stdin;
78099dec-daf2-4532-8e6e-a73ed65d1c50	d4c92ce1-478d-439b-a575-bc8f406190ce	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	96ab35af-6a9e-4f08-82ad-a5742c386ef8	2026-05-08 02:24:01.783149+00	2026-05-08 02:32:19.324782+00	1.66	completed	\N	\N	\N	\N	2026-05-08 02:24:01.783149+00
d80bc371-994b-4128-896d-8c53acebab40	52be2535-24f2-4ad7-b7ff-fa2425898a27	0e34705e-59f0-4c48-b0e2-e70184163be1	0e431b0c-0912-4069-ae7c-22c6094f35c3	2026-05-09 20:13:00+00	2026-05-09 20:25:00+00	12	completed	\N	\N	\N	\N	2026-05-10 04:13:52.864061+00
e8467a9b-a2e3-4993-bb29-48f58f173931	b8ef25c0-117b-4cc5-80dd-d80c09e295bb	fe9220e1-1e1d-43b3-864f-e65cec183c90	4f066d16-8368-41b2-9bea-2cb97c0ad231	2026-05-12 12:47:57.42451+00	2026-05-12 13:01:10.240795+00	6.61	completed	\N	\N	\N	\N	2026-05-12 09:23:05.057484+00
cb886dc2-90f3-45db-bb6b-34b7f4630984	84099f46-76e9-4036-9ad9-19e328a5eda8	fe9220e1-1e1d-43b3-864f-e65cec183c90	eec800c3-e2da-4ec0-a1b2-584663d0948b	2026-05-12 13:23:01.297606+00	2026-05-12 13:30:12.895306+00	3.6	completed	\N	\N	\N	\N	2026-05-12 13:23:01.297606+00
ac87dfee-db0f-4c8f-873e-cf718d4be6bb	25ae7e59-e3cc-4cec-b25a-d04d3938c936	fe9220e1-1e1d-43b3-864f-e65cec183c90	4a890d1b-017e-46c2-b640-86ec85ad2b79	2026-05-13 08:57:02.871515+00	2026-05-13 09:02:09.949608+00	10.24	completed	\N	\N	\N	\N	2026-05-13 08:57:02.871515+00
d7e5b841-10e1-4b6c-82c7-8871dc245617	21876b78-4639-423f-8072-96cd5249a165	1d1be295-3305-4397-b9fb-dac021af69b0	e6ab62e5-168d-44cf-8833-984418db64c9	2026-05-15 08:10:49.108397+00	2026-05-15 08:33:53.277445+00	11.53	completed	\N	\N	\N	\N	2026-05-15 08:10:49.108397+00
0e85da91-2cbb-4f1e-b7f8-8f7e21c707d8	b9f151c9-082f-4fb6-964d-68f05eb630f5	fe9220e1-1e1d-43b3-864f-e65cec183c90	a3171e1b-46a4-496c-a565-b52d02d6d22e	2026-05-13 09:10:41.810433+00	2026-05-13 09:11:45.026404+00	5.27	completed	\N	\N	5	\N	2026-05-13 09:10:41.810433+00
326a04f5-1018-4607-b897-c5bd29d96da3	641ddf32-0e35-4848-94e6-23a58cf179d6	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	d435c970-5cbb-48ea-848b-d3645d70d380	2026-05-15 01:29:47.837253+00	2026-05-15 01:51:43.949085+00	4.39	completed	\N	\N	\N	\N	2026-05-15 01:29:44.011042+00
2d1870c3-bbae-40d6-8d75-7d628023f593	4053ebf1-2597-4d21-a3c3-695fe89d8f74	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	0288bc86-0399-4722-9453-62d3858e2b35	2026-05-15 01:51:52.461609+00	2026-05-15 01:51:57.489413+00	0.04	completed	\N	\N	\N	\N	2026-05-15 01:51:52.461609+00
48de07c2-ab02-4ec5-be43-11c26be3a357	52be2535-24f2-4ad7-b7ff-fa2425898a27	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	e83a7886-7822-4e84-8202-4d48dead3157	2026-05-15 01:56:55.968509+00	2026-05-15 01:57:31.898504+00	0.6	completed	\N	\N	\N	\N	2026-05-15 01:56:55.968509+00
7efb1b8a-0e5d-4327-95b1-67aa14b0fed9	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	1d1be295-3305-4397-b9fb-dac021af69b0	7cb43043-23af-46a9-b54d-76868a9c4586	2026-05-15 01:58:12.710615+00	2026-05-15 02:00:22.999902+00	1.09	completed	\N	\N	\N	\N	2026-05-15 01:57:54.356339+00
8f734fc1-3233-4e18-9fb8-4dd9f138cf0b	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	0e34705e-59f0-4c48-b0e2-e70184163be1	eddc8e6a-d1c5-4271-841c-ec91037d60cf	2026-05-15 02:01:17.043522+00	2026-05-15 02:07:00.338815+00	2.86	completed	\N	Leave earlier because of headache  	\N	\N	2026-05-15 02:00:11.036041+00
87ea4825-de16-4c9d-b7ba-18337fc0c53f	d0b553bf-c531-4561-8d65-df1b7fcc08f7	b2c1abec-95f6-442f-99af-0ce842aacfe2	fed751a3-4d7b-41f3-9495-a0540cbe03e3	2026-05-08 01:44:53.323751+00	2026-05-08 02:04:18.879531+00	11.66	completed	\N	\N	4	Good	2026-05-08 01:43:32.252975+00
884ec733-a01b-408d-af88-595f87527f48	d0b553bf-c531-4561-8d65-df1b7fcc08f7	0e34705e-59f0-4c48-b0e2-e70184163be1	b0afb999-ce58-41ee-a77d-71280e1d4be0	2026-05-08 03:25:55.998796+00	2026-05-10 02:51:33.742826+00	1707.38	completed	\N	\N	4	\N	2026-05-08 02:27:45.079765+00
39142fc4-a1d3-4c1e-b312-e5db14c15d4f	d0b553bf-c531-4561-8d65-df1b7fcc08f7	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	f0c585e5-32ec-480e-a260-4e33dbd4affd	2026-05-08 02:32:27.368669+00	2026-05-15 01:24:21.722046+00	6007.14	completed	\N	\N	4	\N	2026-05-08 02:32:27.368669+00
4cad0c7b-6bbf-4cf0-aa51-eb169703f80d	0dd9ac7a-9b46-4fe7-b001-5af27af5be03	1d1be295-3305-4397-b9fb-dac021af69b0	2c932cc4-3155-4b2a-8380-d380e0e959b4	2026-05-15 02:37:45.11512+00	2026-05-15 02:38:57.915722+00	2.43	completed	\N	\N	\N	\N	2026-05-15 02:37:42.242217+00
2577024d-b491-416f-950a-d4cda14f64de	7e76254c-a3f4-47b8-8d79-6eeed5e430bd	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	4e7cc6f6-03ab-4230-ad7a-da4a64df7c68	2026-05-15 01:57:36.480052+00	2026-05-15 02:39:15.479721+00	20.82	completed	\N	\N	\N	\N	2026-05-15 01:57:36.480052+00
c1e5218e-9804-4fb9-947b-72def093ff2e	ae2abc1b-7697-4549-a74e-7a723a11b8f3	1d1be295-3305-4397-b9fb-dac021af69b0	72be91d9-16e7-41a7-84a7-d81cf5d3dc58	2026-05-15 02:46:33.358875+00	2026-05-15 03:00:01.162886+00	6.73	completed	\N	\N	\N	\N	2026-05-15 02:46:33.358875+00
f273d686-63d2-4259-9640-0f3be52682db	47a1f317-53a8-4903-858a-eba3b1026e56	1d1be295-3305-4397-b9fb-dac021af69b0	6926bcda-652a-48fe-a8f7-535d055647d5	2026-05-18 06:18:55.001393+00	2026-05-18 06:29:45.205017+00	5.42	completed	/media/proof_f273d686-63d2-4259-9640-0f3be52682db.png	..a	5	Very Good Tutor !!!!!	2026-05-18 06:18:55.001393+00
3d79e3f8-5103-4e75-b16a-628a6312ecf5	151a91ea-7221-4f06-b1cb-a901f3054207	0e34705e-59f0-4c48-b0e2-e70184163be1	c9937048-70a3-4bbb-8cf1-25ea9b6992dd	2026-05-15 02:11:51.611556+00	2026-05-18 01:17:02.237612+00	1066.29	completed	/media/proof_3d79e3f8-5103-4e75-b16a-628a6312ecf5.png	Baking complete	4	\N	2026-05-15 02:11:48.655903+00
3dda27e5-485f-4081-9fb8-374a8f6b4fdc	c5c15117-37b5-44b6-8928-843ac2710526	1d1be295-3305-4397-b9fb-dac021af69b0	3c251b65-5549-4098-8484-298573dc657d	2026-05-15 06:23:04.280592+00	2026-05-15 08:08:16.222007+00	52.6	completed	\N	\N	5	\N	2026-05-15 06:23:04.280592+00
8676a35d-05b3-4d29-8f75-e6a0b5f056a3	5103f24e-9fc0-468c-ae91-031ae30af2ca	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	4f51cfa7-6212-477e-b0fe-25ad6e668cfb	2026-05-15 02:39:19.763798+00	2026-05-18 01:37:07.154218+00	3406.23	completed	/media/proof_8676a35d-05b3-4d29-8f75-e6a0b5f056a3.jpg	\N	\N	\N	2026-05-15 02:39:19.763798+00
77ad752b-1cfd-45ab-b39f-7c2207c5074d	e541fd8d-f9f0-47ae-bed4-e053543f681f	1d1be295-3305-4397-b9fb-dac021af69b0	1101df65-a10d-4cb4-bf01-b8998963e2f9	2026-05-18 01:09:35.206152+00	2026-05-18 01:51:09.934773+00	20.79	paused	\N	\N	\N	\N	2026-05-18 01:09:33.025067+00
e388302e-adbf-4170-a6aa-647080be8920	bea0db2c-bc1d-48b7-b1f5-718133ba9a72	1d1be295-3305-4397-b9fb-dac021af69b0	7ce1ea63-b26a-4442-a0ee-3ca2ae7adea2	2026-05-18 06:36:35.720028+00	2026-05-18 06:48:15.830493+00	11.67	completed	/media/proof_e388302e-adbf-4170-a6aa-647080be8920.png	\N	\N	\N	2026-05-18 06:36:35.720028+00
4bdbf552-b82e-4786-bfcb-b7fe32b76042	30561113-6b83-4f0d-83fc-1ec9b397fe0c	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	1eb89440-8603-48c3-9deb-856ccb2d799f	2026-05-18 01:37:11.335785+00	2026-05-18 02:09:12.376828+00	16.01	completed	/media/proof_4bdbf552-b82e-4786-bfcb-b7fe32b76042.jpg	\N	5	\N	2026-05-18 01:37:11.335785+00
faae2b5a-edf0-4d39-8633-c4fdd8ccc1df	33abe8bf-cf82-4116-95ad-18e2762e4cb7	1d1be295-3305-4397-b9fb-dac021af69b0	958ab6a5-618e-47b3-be2b-cbd5dfb2dd22	2026-05-18 01:51:15.981649+00	2026-05-18 02:10:44.53955+00	9.74	completed	/media/proof_faae2b5a-edf0-4d39-8633-c4fdd8ccc1df.jpeg	done job 	5	Good job !!!!!	2026-05-18 01:51:15.981649+00
65bbb109-eb3e-4422-847f-437810b2be68	4e330881-c380-4103-837e-0574a34290bb	1d1be295-3305-4397-b9fb-dac021af69b0	072434db-8422-4e26-ab30-d742a3796579	2026-05-15 02:14:32.782585+00	2026-05-15 02:14:43.660256+00	0.09	completed	\N	\N	5	great work 	2026-05-15 02:14:32.782585+00
a30c61f1-3f5a-4573-b71f-57dee2b391ca	5cb53a8d-f994-42eb-8434-66bd5affeeda	0e34705e-59f0-4c48-b0e2-e70184163be1	61802813-4154-4df1-b667-629523374e3d	2026-05-18 01:18:54.327994+00	2026-05-18 02:23:07.391763+00	32.11	completed	/media/proof_a30c61f1-3f5a-4573-b71f-57dee2b391ca.png	Job Done !!!	\N	\N	2026-05-18 01:18:54.327994+00
83c2142e-0f84-4732-9cc2-2479c2c25a57	ef24b3be-86c4-4f2b-96f0-7e723358f363	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	ee73d9d3-4f92-460b-ae71-11ca394d0d62	2026-05-18 02:12:03.239882+00	2026-05-18 02:24:25.217086+00	6.18	completed	/media/proof_83c2142e-0f84-4732-9cc2-2479c2c25a57.jpg	\N	\N	\N	2026-05-18 02:12:03.239882+00
9cb98929-30d7-4bd6-aef3-f40b317cb555	780d55fb-8568-4a87-bc57-c01410cc8f96	0e34705e-59f0-4c48-b0e2-e70184163be1	60a834f9-bc1e-49ee-83b7-5d5275798864	2026-05-18 02:29:20.522404+00	2026-05-18 02:58:48.375333+00	14.73	completed	/media/proof_9cb98929-30d7-4bd6-aef3-f40b317cb555.jpg	👍✅	\N	\N	2026-05-18 02:29:20.522404+00
58cb22fb-7da3-4418-aca0-96704bfb81ce	36eeaba9-bf3b-4bc4-b0ef-2e1df46ad613	1d1be295-3305-4397-b9fb-dac021af69b0	69e03c1e-df59-4db1-8129-f6c58057974a	2026-05-18 07:08:57.690645+00	2026-05-18 07:12:00.24758+00	0.82	completed	/media/proof_58cb22fb-7da3-4418-aca0-96704bfb81ce.jpeg	\N	5	superb job	2026-05-18 07:08:57.690645+00
b5a0d1dc-443a-4106-a225-6da2a267174c	a18f5eef-0748-4c12-a10d-65fc81653e40	1d1be295-3305-4397-b9fb-dac021af69b0	a4d21cf7-dca0-4e34-b3cb-5625cea1a0d2	2026-05-18 07:16:56.052623+00	2026-05-18 07:29:59.573625+00	26.12	completed	/media/proof_b5a0d1dc-443a-4106-a225-6da2a267174c.jpeg	\N	\N	\N	2026-05-18 07:16:56.052623+00
ccf12d7c-9416-49ca-85fd-f7933a0ec019	abeae079-83e1-403e-a1a1-7e8fba3921f3	1d1be295-3305-4397-b9fb-dac021af69b0	6441224c-58e7-4cc5-84df-5baff0ec614e	2026-05-18 07:56:34.64834+00	2026-05-22 06:48:19.690953+00	853.76	completed	/media/proof_ccf12d7c-9416-49ca-85fd-f7933a0ec019.jpeg	\N	\N	\N	2026-05-18 07:56:34.64834+00
80eed491-24d1-49ec-8594-2ef09b175a04	cec4404c-618c-4a38-a389-87da7b2f5e4d	1d1be295-3305-4397-b9fb-dac021af69b0	8d930fcf-4376-4f7f-af2b-b47c8cd2cfc6	2026-05-22 07:10:04.337767+00	2026-05-22 07:13:22.176821+00	2.93	completed	/media/proof_80eed491-24d1-49ec-8594-2ef09b175a04.webp	\N	\N	\N	2026-05-22 07:10:04.337767+00
4709c7b3-6497-462f-aa59-49a9c8f0568d	ace2ac19-19bd-496f-935a-bfa2382d3dbe	1d1be295-3305-4397-b9fb-dac021af69b0	2497ec1d-cd73-4559-abb0-4692c6e67fa6	2026-05-22 07:17:23.957686+00	2026-06-04 03:07:40.813818+00	14222.12	completed	/media/proof_4709c7b3-6497-462f-aa59-49a9c8f0568d.jpg	\N	\N	\N	2026-05-22 07:17:23.957686+00
1b52f46e-4901-4ae4-9e8f-d018ab429e45	203b2323-bf14-4c4f-8c85-c227395a5962	1d1be295-3305-4397-b9fb-dac021af69b0	f20c9d7a-20bb-4957-8d3e-623eeab21bb3	2026-06-04 03:08:38.192074+00	2026-06-04 03:11:29.254981+00	1.43	completed	/media/proof_1b52f46e-4901-4ae4-9e8f-d018ab429e45.jpg	\N	\N	\N	2026-06-04 03:08:38.192074+00
38fd1044-48b5-44c3-8969-d4f9cfae0a98	0f435d3e-3291-4f63-b794-e09a0a4029dc	1d1be295-3305-4397-b9fb-dac021af69b0	3a9dfad7-1a31-4869-9235-5585a8f949d0	2026-06-04 03:19:26.370921+00	2026-06-04 03:21:22.857286+00	0.97	completed	/media/proof_38fd1044-48b5-44c3-8969-d4f9cfae0a98.jpg	\N	\N	\N	2026-06-04 03:19:26.370921+00
c9a4497f-e966-4ba7-b05c-66199ff7b646	4e330881-c380-4103-837e-0574a34290bb	b2c1abec-95f6-442f-99af-0ce842aacfe2	edaf4d3f-0719-4529-8771-617a6b548e88	2026-05-11 00:13:07.905441+00	2026-06-04 03:58:44.939818+00	17392.81	completed	\N	[Admin force-stopped by Admin]	\N	\N	2026-05-08 02:06:23.40168+00
448b1beb-09c1-40b8-a6ff-9f69330db9fc	e5d2b26e-48a5-4191-905a-318e259c551b	0e34705e-59f0-4c48-b0e2-e70184163be1	f0b492d9-3511-45ed-b5fc-5b56e32fb2a0	2026-05-18 06:47:23.522927+00	2026-06-04 03:58:51.509227+00	24311.47	completed	\N	[Admin force-stopped by Admin]	\N	\N	2026-05-18 06:47:23.522927+00
1bcc744f-55ef-4685-83a8-295cf559c678	7507176e-1403-4153-a6eb-ff87c9effa63	1d1be295-3305-4397-b9fb-dac021af69b0	4ca1af31-033b-4114-8320-50393601aa21	2026-06-04 03:56:09.876762+00	2026-06-04 04:05:39.973604+00	4.75	completed	/media/proof_1bcc744f-55ef-4685-83a8-295cf559c678.jpg	\N	\N	\N	2026-06-04 03:56:09.876762+00
2214a75b-048e-4113-b87a-da2c773f42c8	0ffe0c1c-ae5c-4b3d-996b-42bfef0bd088	1d1be295-3305-4397-b9fb-dac021af69b0	d9d90e58-8ac6-468f-b698-b95ee4aba96a	2026-06-04 04:05:45.875998+00	2026-06-04 04:10:22.087524+00	2.3	completed	/media/proof_2214a75b-048e-4113-b87a-da2c773f42c8.jpg	\N	\N	\N	2026-06-04 04:05:45.875998+00
77857f16-7c27-4700-8778-9409386f9cd9	76a26938-619e-4a4b-8154-5cf76293497c	1d1be295-3305-4397-b9fb-dac021af69b0	7dbe3bbc-e5c7-43d5-be27-eca56807eaaa	2026-06-04 03:11:54.913383+00	2026-06-04 03:16:12.43312+00	2.15	completed	/media/proof_77857f16-7c27-4700-8778-9409386f9cd9.jpg	\N	5	\N	2026-06-04 03:11:54.913383+00
31848d95-cd47-4929-995a-648b915c5b87	9c46be04-759b-4c02-8c09-0a0e0baa3cc2	1d1be295-3305-4397-b9fb-dac021af69b0	b7cf26ed-8ba0-4ede-9d83-51f93c4c65dc	2026-06-04 06:35:51.897116+00	2026-06-04 06:36:11.359311+00	0.32	paused	\N	\N	\N	\N	2026-06-04 06:35:51.897116+00
78a4261e-2dd6-4e11-be01-572de08b336d	2cba6f3b-9370-48eb-837c-54c8d1a384aa	fe9220e1-1e1d-43b3-864f-e65cec183c90	cfc8fc1f-2774-4014-9b20-33da651088c6	2026-06-07 03:53:06.589338+00	2026-06-07 04:00:10.93353+00	3.54	completed	/media/proof_78a4261e-2dd6-4e11-be01-572de08b336d.png	\N	\N	\N	2026-06-07 03:53:06.589338+00
5a9e680c-1e18-41b5-900a-d2087413219b	51581b4c-6ec0-4a03-adb2-3be79875244a	fe9220e1-1e1d-43b3-864f-e65cec183c90	2d4ebe27-49d9-4a7c-9572-cddfc6cd3baf	2026-06-07 04:11:50.928555+00	2026-06-07 04:15:25.954209+00	1	completed	/media/proof_5a9e680c-1e18-41b5-900a-d2087413219b.png	\N	\N	\N	2026-06-07 04:11:50.928555+00
0c0de8ec-e6bc-4a08-9092-342d7c74ea4d	ced5b375-ac3f-4ade-95f9-c0dbc6aadb51	fe9220e1-1e1d-43b3-864f-e65cec183c90	13e711b9-e145-4dbc-a957-8a60cd7ee1df	2026-06-07 11:05:33.980945+00	2026-06-07 12:19:39.271295+00	37.04	paused	\N	\N	\N	\N	2026-05-12 13:48:26.887457+00
6762eb91-2291-4270-8721-9ae61ed9223c	82e328ee-42f1-4caf-bb18-b5b136e78a5b	1d1be295-3305-4397-b9fb-dac021af69b0	fc2e27c7-c3e6-417c-90e4-830b0eb673a5	2026-06-10 07:32:48.334476+00	2026-06-10 07:36:45.533967+00	1.34	completed	/media/proof_6762eb91-2291-4270-8721-9ae61ed9223c.webp	\N	\N	\N	2026-06-10 07:32:48.334476+00
da52f805-b0bf-426e-80d2-2115a7b7a130	ed306b07-1f3d-4d7d-b9e0-c0e856ba7f8a	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	e6f68f54-4019-438c-b536-0d16a1a1d2d3	2026-06-04 06:20:50.672607+00	2026-06-10 07:45:29.218747+00	7677.69	completed	\N	[Admin force-stopped by Admin]	\N	\N	2026-06-04 06:20:50.672607+00
93cecfb3-ffef-409f-b3fe-44e9ea4e8ada	ca82eb96-34d1-43ad-bc42-a30661bb02b7	1d1be295-3305-4397-b9fb-dac021af69b0	d82ec91d-df36-4b6d-945e-c0325ba6c1db	2026-06-10 08:05:42.580774+00	2026-06-10 08:08:32.651352+00	1	completed	/media/proof_93cecfb3-ffef-409f-b3fe-44e9ea4e8ada.png	\N	\N	\N	2026-06-10 08:05:42.580774+00
19d4ce9c-29c5-483a-9725-f847b24f6666	a9f98e44-6b5e-4e6e-a163-d2e8d76601f8	1d1be295-3305-4397-b9fb-dac021af69b0	337a84d8-68ea-49b1-b050-e703c3884819	2026-06-10 08:08:43.75048+00	2026-06-10 08:09:30.365776+00	0.52	completed	/media/proof_19d4ce9c-29c5-483a-9725-f847b24f6666.png	\N	\N	\N	2026-06-10 08:08:41.544354+00
87a5baf6-50df-4b9f-8e16-53658773a986	13a98f0a-a7ea-41d3-922b-7049302b2c3e	1d1be295-3305-4397-b9fb-dac021af69b0	f1b4104d-3e91-4581-a4ea-3855decae38a	2026-06-10 08:11:50.894963+00	2026-06-10 08:13:58.994895+00	0.4	completed	/media/proof_87a5baf6-50df-4b9f-8e16-53658773a986.png	\N	\N	\N	2026-06-10 08:11:50.894963+00
99409e39-aece-4965-8396-a47e4fba546c	52abd215-7c80-4fe8-8b30-391b67c2f2a2	1d1be295-3305-4397-b9fb-dac021af69b0	1dbabff5-f1a4-4eca-9e20-bbb7b0125b70	2026-06-10 08:15:41.003978+00	2026-06-10 08:16:17.677424+00	0.34	completed	/media/proof_99409e39-aece-4965-8396-a47e4fba546c.png	\N	\N	\N	2026-06-10 08:15:01.272985+00
2ba73b6f-81b6-4611-9c24-898668723939	86edd7e3-4912-476e-ba56-b94f81914b9f	7e438196-958b-4cb5-831c-0027b8a009cb	9e39b819-255b-4602-8bdb-cf4b1dd8d928	2026-06-24 06:56:34.450172+00	2026-06-24 06:59:42.20494+00	2.97	completed	/media/proof_2ba73b6f-81b6-4611-9c24-898668723939.png	\N	\N	\N	2026-06-24 06:56:34.450172+00
bc57452e-fc2d-4417-999d-81e3d15fbb80	fff30804-5762-4039-a8bf-c585d8fbb20d	7e438196-958b-4cb5-831c-0027b8a009cb	1c4e3d96-3914-4b41-837f-0cf67debb0d1	2026-06-24 07:03:25.952599+00	2026-06-24 07:05:43.466463+00	20	completed	/media/proof_bc57452e-fc2d-4417-999d-81e3d15fbb80.png	\N	\N	\N	2026-06-24 07:03:25.952599+00
026b4673-c8d2-40e7-8968-974a34d3da7a	37fe1bcd-6cee-434f-8ea1-993ae6b9faa2	7e438196-958b-4cb5-831c-0027b8a009cb	1804fcc4-e9e5-4d78-a9a4-e3908c9aa487	2026-06-24 07:08:13.520456+00	2026-06-24 07:11:21.302804+00	300	completed	/media/proof_026b4673-c8d2-40e7-8968-974a34d3da7a.png	\N	\N	\N	2026-06-24 07:07:47.429773+00
749c9b40-b62a-4b9d-977e-1dd9a8e95b07	7ec1de4b-ad98-4a6b-b945-50b1235c909c	2c9fb196-b062-42f1-9894-e7178ea038f6	09239866-94df-45f8-991f-2f790a8af2c1	2026-06-24 07:38:41.136713+00	2026-06-24 07:41:21.291891+00	40000	completed	/media/proof_749c9b40-b62a-4b9d-977e-1dd9a8e95b07.png	\N	\N	\N	2026-06-24 07:38:41.136713+00
ee0770e0-7a40-46a6-aedc-ab4260dd2710	dbeabfde-3496-4589-9868-3df960931496	2c9fb196-b062-42f1-9894-e7178ea038f6	5d38068b-490d-4d1d-810d-5016d99d4647	2026-06-24 07:44:53.497872+00	2026-06-24 07:46:27.933044+00	0.1	completed	/media/proof_ee0770e0-7a40-46a6-aedc-ab4260dd2710.png	\N	\N	\N	2026-06-24 07:44:53.497872+00
d7b54b5c-dc2f-4d5d-927f-7f8fb76eab08	bbdae445-6ded-441b-80e9-f023ac17f290	1d1be295-3305-4397-b9fb-dac021af69b0	d89c1009-e407-481a-9b17-a58e1e25217e	2026-06-24 08:05:48.069954+00	2026-06-24 08:10:12.376543+00	48	completed	/media/proof_d7b54b5c-dc2f-4d5d-927f-7f8fb76eab08.jpg	\N	\N	\N	2026-06-24 08:05:48.069954+00
194346ce-3219-4db5-8616-bcb071548543	260071d4-3bdd-4e0d-ad17-cb272e94a21b	1d1be295-3305-4397-b9fb-dac021af69b0	9d95802f-2cd3-4384-9921-c569234f2b57	2026-06-24 08:12:34.782424+00	2026-06-24 08:15:44.338851+00	1.98	completed	/media/proof_194346ce-3219-4db5-8616-bcb071548543.jpg	\N	\N	\N	2026-06-24 08:12:19.341305+00
49a4b735-6ae9-48ec-bf8d-d94367d90962	2251975a-557a-4e34-a5c4-7bfa41f9a179	067c11cc-f14f-439a-a673-c48b7b210aa1	aeb2a11f-6d55-45aa-99ea-29b67ea604b1	2026-06-25 04:29:34.043859+00	2026-06-25 04:32:53.677953+00	0.55	completed	/media/proof_49a4b735-6ae9-48ec-bf8d-d94367d90962.png	finish work at 6.05pm	\N	\N	2026-06-25 04:28:39.280081+00
915d6476-52b1-44ae-bdb1-43a292333d84	eae56c0f-e54d-42fb-a805-726cf0bedc32	067c11cc-f14f-439a-a673-c48b7b210aa1	12527f86-1d78-45a2-b377-3cb64630acab	2026-06-25 04:39:24.305397+00	2026-06-25 04:40:56.316289+00	10	completed	/media/proof_915d6476-52b1-44ae-bdb1-43a292333d84.png	\N	5	very good new staff very veryyyyyyyyyyyyyyyy gooood	2026-06-25 04:39:24.305397+00
a8958c00-6839-413a-9a56-73b2d4a7d901	5476870a-7dc2-4dca-b274-5c6430963887	1d1be295-3305-4397-b9fb-dac021af69b0	1d5a2314-0e76-429e-a698-3b1a2dbd0205	2026-06-24 08:18:28.613128+00	2026-06-25 06:42:24.006242+00	1209.53	completed	\N	[Admin force-stopped by Admin]	\N	\N	2026-06-24 08:18:14.668619+00
d0a71f08-98f9-4114-b121-25a6529012b5	2251975a-557a-4e34-a5c4-7bfa41f9a179	1d1be295-3305-4397-b9fb-dac021af69b0	b4828f94-7799-4396-96fa-b63209bcb2ed	2026-06-25 06:45:53.03364+00	2026-06-25 07:02:38.351305+00	2.79	completed	\N	[Admin force-stopped by Admin]	\N	\N	2026-06-25 06:45:53.03364+00
fff31505-4dc3-451a-bc99-063738f90e37	83056254-de14-4e73-978c-817a17d6953b	1d1be295-3305-4397-b9fb-dac021af69b0	d1e1268a-3448-4a6f-86d4-9ef0dbec2326	2026-06-26 06:32:53.508375+00	2026-06-26 06:33:39.709381+00	0.13	completed	/media/proof_fff31505-4dc3-451a-bc99-063738f90e37.png	\N	\N	\N	2026-06-26 06:32:49.847582+00
b245bec7-da0b-4327-91de-bfa2f51a4fb5	b76b9fc1-d6af-4328-a0c4-fbb6addcd431	a5ed9b09-88c3-453f-8db1-75e8773a7344	1dc41b70-bb45-4501-a0f8-0e5564b745aa	2026-07-06 13:03:24.43711+00	2026-07-06 13:04:37.36484+00	0.73	paused	\N	\N	\N	\N	2026-07-06 13:03:22.117306+00
15b2b5a8-a2bf-44eb-b3c7-d71a4eef9fb5	0611dc85-77bc-449d-ba62-9c3855f45be5	2c9fb196-b062-42f1-9894-e7178ea038f6	807a0395-2149-4cd5-b96e-0d48d3a9fc54	2026-07-08 01:39:55.143804+00	2026-07-10 01:18:53.656223+00	1.4	settled	\N	\N	\N	\N	2026-07-08 01:39:55.143804+00
821532ff-2f54-4cc9-9cb0-9510423c98a2	b050ceb2-95b8-4122-bba0-bb44d33d4c6a	2c9fb196-b062-42f1-9894-e7178ea038f6	c9a424bc-5046-47c3-9a0a-51ce17ee46df	2026-07-10 01:20:54.723161+00	2026-07-10 01:23:12.692311+00	2.02	settled	\N	[Admin force-stopped by Admin]	\N	\N	2026-07-10 01:20:54.723161+00
048fd2bb-98d7-495b-a068-3c1eaa7faede	7b6c6c28-070b-4218-b4c3-1e40fbff59a1	2c9fb196-b062-42f1-9894-e7178ea038f6	1b7c555d-f98f-42f9-9207-8dbc31c75a09	2026-07-10 07:46:02.04519+00	2026-07-10 07:46:29.020863+00	0.07	settled	\N	\N	\N	\N	2026-07-10 07:46:02.04519+00
66590621-004a-4398-ab5b-711307086096	a43ed828-7a42-48b7-97bb-516963c7efad	2c9fb196-b062-42f1-9894-e7178ea038f6	3a5f77ea-04de-4d09-ae88-8c6a161cc32a	2026-07-10 07:57:32.656+00	2026-07-10 07:58:09.503561+00	0.1	settled	\N	[Admin force-stopped by Admin]	\N	\N	2026-07-10 07:57:32.656+00
5f9c5867-6479-4963-b443-bb7d8824e818	35d43768-a605-4bac-82f5-2e7029e916b8	f2c26e4f-30c3-4618-a4b6-0771590958b7	f30cf089-c88f-49a3-85d7-2bb94740306d	2026-07-07 14:35:26.143678+00	2026-07-07 14:37:24.01841+00	0	completed	/media/proof_5f9c5867-6479-4963-b443-bb7d8824e818.jpeg	\N	\N	\N	2026-07-07 14:35:26.143678+00
2c4f04c9-341d-4b12-8544-0b4a65067dab	f80cc3a4-4dfd-47f6-b57f-d4dce3bf0b96	a5ed9b09-88c3-453f-8db1-75e8773a7344	8b2f9387-1a69-4fbb-b546-fe693689ce27	2026-07-06 13:04:43.243823+00	2026-07-06 13:06:54.246623+00	50	settled	/media/proof_2c4f04c9-341d-4b12-8544-0b4a65067dab.jpg	\N	5	very good and on time	2026-07-06 13:04:43.243823+00
29de6efd-d4f3-4c49-a63a-ce4428dda75b	02c5f7cf-2c93-4890-a974-aea3b55c4bce	1d1be295-3305-4397-b9fb-dac021af69b0	ac212197-56a0-4728-9866-8b3c5780ce63	2026-06-26 06:43:06.949556+00	2026-06-26 06:44:15.166874+00	0.5	settled	/media/proof_29de6efd-d4f3-4c49-a63a-ce4428dda75b.png	\N	\N	\N	2026-06-26 06:43:06.949556+00
96675f78-383d-4307-9888-51c8a54a384d	8cf9d55c-d09a-4128-8f28-759ef651037a	e57f811f-ddfd-406f-8050-bedf7bdacd10	33690eac-8e2a-46c2-a65c-baba21421fac	2026-07-10 13:31:31.613958+00	2026-07-10 13:31:37.549338+00	0.01	settled	\N	\N	\N	\N	2026-07-10 13:31:31.613958+00
434b54ca-dc99-423d-ac6b-7ba0ec1b6ca6	a48cbcff-3b1b-405b-911d-50c7a5d545c7	e57f811f-ddfd-406f-8050-bedf7bdacd10	a33dcbdb-6277-4fc3-90cb-a2b71acee15e	2026-07-10 05:44:00+00	2026-07-24 08:44:00+00	678	settled	\N	\N	\N	\N	2026-07-10 13:44:16.413743+00
f4df637a-ee77-4597-afd4-1e3e965ee89c	34c5eab5-c49b-448a-aa9a-a5258c07fc27	e57f811f-ddfd-406f-8050-bedf7bdacd10	3f558328-60c0-4064-808a-8471a6bff0a3	2026-07-10 13:47:35.124739+00	2026-07-10 13:47:38.452576+00	0.01	completed	\N	\N	\N	\N	2026-07-10 13:47:35.124739+00
6b36c21c-eb8c-4e3e-b2ff-d52d704ef18d	d97993ae-0b13-492a-a5ed-ff728ec354f3	e57f811f-ddfd-406f-8050-bedf7bdacd10	ea90f72b-395f-4ffd-b797-f4a4f0375dd0	2026-07-10 05:35:00+00	2026-07-17 09:35:00+00	1720	settled	\N	\N	\N	\N	2026-07-10 13:35:20.787451+00
6f24024d-6d58-44a7-a143-af951ecc53f2	630f3f60-d74f-48cb-a37c-0a2e7af2e7b6	2c9fb196-b062-42f1-9894-e7178ea038f6	b7e6e96f-9ce9-471e-acc1-c340419b8b09	2026-07-10 13:43:08.061013+00	2026-07-10 13:43:10.952226+00	0.01	settled	\N	\N	\N	\N	2026-07-10 13:43:08.061013+00
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, employer_id, title, description, requirements, location, latitude, longitude, pay_rate_per_minute, estimated_duration_minutes, category, status, max_applicants, starts_at, photo_url, created_at, updated_at, project_id, company_tag) FROM stdin;
2c330e1c-0dd9-4930-92c0-c15479d6f516	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 04:36:17.547488+00	2026-05-06 04:53:50.822559+00	\N	\N
ce644982-d348-4565-88a6-777b0507aa2e	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 04:35:47.821408+00	2026-05-06 04:53:53.307574+00	\N	\N
526abeee-ecba-4c48-80f0-b8d5b676bceb	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 03:58:11.066895+00	2026-05-06 04:53:56.176669+00	\N	\N
d170f634-7144-48d5-a5e2-ebeb58445e1b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 03:57:30.765032+00	2026-05-06 04:53:58.790423+00	\N	\N
cd76e3ea-4797-4536-8efa-3851ea38ec98	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 03:46:51.960176+00	2026-05-06 04:54:01.656711+00	\N	\N
9d9362c0-5262-4e1a-95ee-db8490d3175a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper clothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 03:46:31.439353+00	2026-05-06 04:54:04.175512+00	\N	\N
845ff069-48b5-43f0-9ca0-4fcfa5a71ea8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning - Monday (9 am)	- Cleaning office toilet by scrubbing toilet bowl, washing sink, wiping mirror, and mopping wet floor using disinfectant during morning shift; Replacing tissue rolls and refilling hand soap in office toilet after checking low supplies; \n- Wiping conference table, chairs and glass surfaces in meeting room, arranging furniture neatly; \n- Wiping pantry countertop, cleaning appliances, disposing waste and refilling supplies; \n- Cleaning glass windows, partitions and window frames using appropriate cleaner.	Wear proper cothing, Must not exceed the age of 60, Does not have any health issue	Bandar Puteri Puchong 	\N	\N	0.2	240	Cleaning	CANCELLED	2	2026-05-11 01:00:00+00	\N	2026-05-06 03:46:08.811871+00	2026-05-06 04:54:06.491098+00	\N	\N
d4c92ce1-478d-439b-a575-bc8f406190ce	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Baking Cookies	Seeking an experienced baker to prepare 50 classic chocolate chip cookies for a corporate event. You will be responsible for the entire baking process, ensuring consistent size and quality. workspace must be sanitized before and after the task.	Have extensive baking experience, Recipe is provided ,Basic tools is provided but you are welcome to bring your own tool	Bandar Puteri	\N	\N	0.2	480	Cooking	OPEN	3	2026-05-09 01:00:00+00	\N	2026-05-08 02:21:07.552357+00	2026-05-08 02:21:07.552357+00	\N	\N
641ddf32-0e35-4848-94e6-23a58cf179d6	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning 	Clean the office area.	wear proper cloth for cleaning	Bandar Puteri	\N	\N	0.2	240	Cleaning	COMPLETED	1	2026-05-15 02:30:00+00	\N	2026-05-15 01:22:38.712734+00	2026-05-18 01:57:36.931667+00	\N	\N
b8ef25c0-117b-4cc5-80dd-d80c09e295bb	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Design a webpage for A Company	Design a webpage for A Company	\N	Penang	\N	\N	0.5	120	Other	COMPLETED	1	2026-05-11 11:50:00+00	\N	2026-05-11 11:51:03.348159+00	2026-05-16 05:05:46.805546+00	\N	\N
84099f46-76e9-4036-9ad9-19e328a5eda8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	create web app for company B	web app for company B	\N	Penang	\N	\N	0.5	120	Other	COMPLETED	1	2026-05-16 13:21:00+00	\N	2026-05-12 13:22:04.147143+00	2026-05-16 05:05:28.682895+00	\N	\N
b9f151c9-082f-4fb6-964d-68f05eb630f5	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	quick fix web page B	quick fix web page B	\N	Penang	\N	\N	5	1	Other	COMPLETED	1	\N	\N	2026-05-13 09:10:11.346022+00	2026-05-13 09:11:45.010397+00	\N	\N
4e330881-c380-4103-837e-0574a34290bb	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning	Need 2 person to clean the office 	Must have skills and time	Puchong	\N	\N	0.5	480	Cleaning	COMPLETED	2	2026-05-09 03:27:00+00	\N	2026-05-08 01:25:19.918861+00	2026-05-18 02:19:47.676941+00	\N	\N
ced5b375-ac3f-4ade-95f9-c0dbc6aadb51	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	create web app for company C	web app for company C	\N	Penang	\N	\N	0.5	120	Other	CANCELLED	1	2026-05-15 13:47:00+00	\N	2026-05-12 13:47:43.119239+00	2026-06-25 08:01:38.938988+00	\N	\N
25ae7e59-e3cc-4cec-b25a-d04d3938c936	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	quick fix web page bug A	quick fix web page bug A	\N	Penang	\N	\N	2	5	Other	COMPLETED	1	\N	\N	2026-05-13 08:56:22.859289+00	2026-05-16 05:05:12.877601+00	\N	\N
ae2abc1b-7697-4549-a74e-7a723a11b8f3	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Window Cleaning	Clean Office window 	Healthy 	Puchong	\N	\N	0.5	3	Cleaning	COMPLETED	1	\N	\N	2026-05-15 02:45:46.657703+00	2026-05-15 03:00:01.157786+00	\N	\N
d0b553bf-c531-4561-8d65-df1b7fcc08f7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	System Debugger 	Inspect and debug the company computer system to identify software issues and ensure all applications are functioning properly.	Basic IT troubleshooting knowledge, must bring laptop, experience with Windows systems preferred.	Puchong 	\N	\N	0.6	480	Other	COMPLETED	1	2026-05-10 18:39:00+00	\N	2026-05-08 01:37:01.083131+00	2026-05-15 01:24:21.716188+00	\N	\N
21876b78-4639-423f-8072-96cd5249a165	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ee	ee	ee	Puchong	\N	\N	0.5	10	Cleaning	COMPLETED	1	2026-05-15 08:12:00+00	\N	2026-05-15 08:10:17.678703+00	2026-05-15 08:33:53.269517+00	\N	\N
27a29092-992e-4c32-a859-54249a1a7e8a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	Puchong	\N	\N	0.5	120	Cleaning	CANCELLED	1	2026-05-19 06:26:00+00	\N	2026-05-15 06:21:27.602201+00	2026-06-25 08:01:26.033819+00	\N	\N
0dd9ac7a-9b46-4fe7-b001-5af27af5be03	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Fan Repair 	Replace a fan blade 	Have experience	Puchong	\N	\N	2	8	Repair	CANCELLED	1	2026-05-15 02:30:00+00	\N	2026-05-15 02:36:34.700374+00	2026-06-25 08:01:27.980397+00	\N	\N
4053ebf1-2597-4d21-a3c3-695fe89d8f74	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Arrange Office Furniture	Need a team that are capable in arranging the office based on request	Have own transport to meet at our Puchong office	Bandar Puteri Puchong 	\N	\N	0.5	240	Other	CANCELLED	4	2026-05-27 16:35:00+00	\N	2026-05-15 01:35:57.962596+00	2026-06-25 08:01:35.666381+00	\N	\N
52be2535-24f2-4ad7-b7ff-fa2425898a27	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Food Delivery 	Deliver food to the carefully to the intended destination.	Wear Uniform, Must have a form of transportation, Must have license	Puchong Jaya	\N	\N	1	10	Delivery	CANCELLED	1	2026-05-08 03:12:00+00	\N	2026-05-08 03:12:37.053505+00	2026-06-25 08:01:41.501116+00	\N	\N
fd81337c-ee8c-4946-9719-49670d845db1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	task 37	task37	task37	KL	\N	\N	0.67	120	Cleaning	OPEN	1	2026-05-18 01:34:00+00	\N	2026-05-18 01:33:11.916052+00	2026-05-18 01:39:49.729624+00	\N	\N
7e76254c-a3f4-47b8-8d79-6eeed5e430bd	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Arrange Furniture	Arrange Furniture	Have own transport	Puchong 	\N	\N	0.5	480	Cleaning	CANCELLED	3	2026-05-28 01:53:00+00	\N	2026-05-15 01:53:28.770258+00	2026-06-25 08:01:33.822458+00	\N	\N
151a91ea-7221-4f06-b1cb-a901f3054207	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Baking Cookies 	Bake 120 pieces of chocolate chip cookies. Warped it beautifully for delivery. Recipe and tools provided.	Experienced in baking, Bring your own apron, Bring your own cooking utensils is encourage.	Bandar Puteri	\N	\N	0.25	480	Cleaning	COMPLETED	3	2026-05-15 02:30:00+00	\N	2026-05-15 01:44:03.123236+00	2026-05-18 01:17:02.224291+00	\N	\N
4f5c02c2-592f-4ca6-9fd4-b07f17ae9ab4	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test33	test33	Test33	Puchong	\N	\N	0.6	120	Cleaning	CANCELLED	1	2026-05-18 01:27:00+00	\N	2026-05-18 01:26:05.067074+00	2026-06-25 08:01:20.158279+00	\N	\N
e541fd8d-f9f0-47ae-bed4-e053543f681f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	macOS tuition for kids part 3	macOS tuition for kids part 3	\N	Penang	\N	\N	0.5	60	Other	COMPLETED	1	\N	/media/task_e541fd8d-f9f0-47ae-bed4-e053543f681f.png	2026-05-17 07:36:24.711724+00	2026-05-18 01:21:34.860824+00	\N	\N
c5c15117-37b5-44b6-8928-843ac2710526	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	Puchong	\N	\N	0.5	120	Cleaning	COMPLETED	1	2026-05-15 06:24:00+00	\N	2026-05-15 06:22:20.989941+00	2026-05-18 01:21:52.325768+00	\N	\N
b72c4fde-bd02-494b-97c5-447f0ebcca85	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test 34	test34	Test34	Puchong	\N	\N	0.5	120	Cleaning	OPEN	1	2026-05-18 01:28:00+00	\N	2026-05-18 01:27:39.389271+00	2026-05-18 01:27:39.389271+00	\N	\N
92caa73a-ddbe-49a3-b059-f3abb1f38002	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test35	test35	Test35	Puchong 	\N	\N	0.5	120	Cleaning	OPEN	1	2026-05-18 01:30:00+00	\N	2026-05-18 01:29:33.581635+00	2026-05-18 01:29:33.581635+00	\N	\N
b8092a5a-d772-4fe6-93de-f66075c61459	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Tuition for Grade 1 Student	Tuition for Grade 1 Student	\N	Penang	\N	\N	0.5	60	Other	OPEN	1	2026-05-30 13:53:00+00	\N	2026-05-19 13:53:20.336573+00	2026-05-19 13:53:20.336573+00	\N	\N
5184ff7d-0db0-4057-84de-fe079c5027e1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Task38	Task38	Task38	KL	\N	\N	0.67	130	Cleaning	OPEN	1	2026-05-18 01:34:00+00	\N	2026-05-18 01:33:51.915973+00	2026-05-18 01:33:51.915973+00	\N	\N
30561113-6b83-4f0d-83fc-1ec9b397fe0c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Math Tutor	Teach a class of 20 form 5 student.	Have Diploma/Degree, Have experience in teaching	KL	\N	\N	0.5	30	Other	COMPLETED	1	2026-05-18 02:30:00+00	/media/task_30561113-6b83-4f0d-83fc-1ec9b397fe0c.png	2026-05-18 01:33:15.118921+00	2026-05-18 02:09:12.367654+00	\N	\N
9eb29d98-b413-43c7-9aae-5edc72ec2cbb	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test50	test50	test50	KL	\N	\N	0.67	140	Cleaning	OPEN	1	2026-05-18 01:36:00+00	\N	2026-05-18 01:35:33.289972+00	2026-05-18 01:35:33.289972+00	\N	\N
4d95b3e8-405b-4f50-b570-9581847f7118	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	macOS tuition for kids part 2	macOS tuition for kids part 2	\N	Penang	\N	\N	0.5	60	Other	CANCELLED	1	\N	\N	2026-05-17 07:35:32.546019+00	2026-06-25 08:01:22.248165+00	\N	\N
5103f24e-9fc0-468c-ae91-031ae30af2ca	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Food Catering 	need 1 person to help in doing catering business	Must have own transport 	Puchong 	\N	\N	0.8	240	Cooking	COMPLETED	1	2026-05-19 18:36:00+00	\N	2026-05-15 02:37:14.196762+00	2026-05-18 01:37:07.144393+00	\N	\N
21770146-9129-4276-a540-1b1fbe98668f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test100	test100	test100	kl	\N	\N	0.89	120	Cleaning	OPEN	1	2026-05-18 01:38:00+00	\N	2026-05-18 01:37:11.776638+00	2026-05-18 01:37:11.776638+00	\N	\N
33abe8bf-cf82-4116-95ad-18e2762e4cb7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleaning	Clean the office	Did not have any health issue	Puchong	\N	\N	0.5	15	Cleaning	COMPLETED	1	2026-05-18 02:45:00+00	/media/task_33abe8bf-cf82-4116-95ad-18e2762e4cb7.png	2026-05-18 01:44:11.336261+00	2026-05-18 02:10:44.528405+00	\N	\N
bea0db2c-bc1d-48b7-b1f5-718133ba9a72	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Baking Cake	Bake 20 pieces of cake	Must have experience in baking 	Kuala Kangsar	\N	\N	1	10	Cooking	COMPLETED	2	2026-05-18 07:45:00+00	/media/task_bea0db2c-bc1d-48b7-b1f5-718133ba9a72.jpg	2026-05-18 06:33:13.037073+00	2026-05-18 06:48:15.819894+00	\N	\N
780d55fb-8568-4a87-bc57-c01410cc8f96	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	It Tutor	Teach a class of 20 people	Have diploma/bachelor degree, Have Teaching experience	Puchong	\N	\N	0.5	10	Cleaning	COMPLETED	2	2026-05-18 02:30:00+00	/media/task_780d55fb-8568-4a87-bc57-c01410cc8f96.jpg	2026-05-18 02:27:39.933699+00	2026-05-18 02:58:48.361708+00	\N	\N
0363333b-02e9-494a-a567-25aa485eef76	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test333	test333	test333	Serenia City 	\N	\N	0.55	480	Moving	OPEN	2	2026-05-18 02:23:00+00	\N	2026-05-18 02:22:11.383094+00	2026-05-18 02:22:11.383094+00	\N	\N
203b2323-bf14-4c4f-8c85-c227395a5962	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	0.5	119	Cleaning	IN_PROGRESS	2	2026-05-22 08:57:00+00	/media/task_203b2323-bf14-4c4f-8c85-c227395a5962.webp	2026-05-22 07:57:19.701831+00	2026-07-10 01:08:32.371481+00	\N	\N
47a1f317-53a8-4903-858a-eba3b1026e56	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	History Tutor	Teach a class of 20 people 	Have bachelor's degree in history 	puchong 	\N	\N	0.5	10	Other	COMPLETED	2	2026-05-18 15:40:00+00	/media/task_47a1f317-53a8-4903-858a-eba3b1026e56.jpg	2026-05-18 02:31:53.498864+00	2026-05-18 06:29:45.194638+00	\N	\N
5cb53a8d-f994-42eb-8434-66bd5affeeda	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	macOS tuition for kid	macOS tuition for kid	teach kid using macOS	Penang	\N	\N	0.5	60	Other	COMPLETED	1	\N	\N	2026-05-17 07:28:12.297952+00	2026-05-18 02:23:07.381935+00	\N	\N
ef24b3be-86c4-4f2b-96f0-7e723358f363	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Deliver Parcel	Deliver a parcel	Have a transportation 	Puchong	\N	\N	0.5	5	Delivery	COMPLETED	1	\N	/media/task_ef24b3be-86c4-4f2b-96f0-7e723358f363.png	2026-05-18 02:11:22.006226+00	2026-05-18 02:24:25.210665+00	\N	\N
393f8f8f-507a-48e0-bcca-b4d07ec26f56	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Office Cleanig	Cleaning	\N	Puchong	\N	\N	0.5	100	Cleaning	OPEN	1	2026-05-17 02:27:00+00	\N	2026-05-18 02:27:01.17782+00	2026-05-18 02:27:01.17782+00	\N	\N
36eeaba9-bf3b-4bc4-b0ef-2e1df46ad613	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test111	test111	test111	KL City	\N	\N	0.27	2	Repair	COMPLETED	1	2026-05-17 23:08:00+00	/media/task_36eeaba9-bf3b-4bc4-b0ef-2e1df46ad613.jpeg	2026-05-18 07:03:31.487906+00	2026-05-18 07:12:00.240528+00	\N	\N
0cd69a25-5937-407a-a71c-19a093bd5422	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Math Tuition	Math Tuition	\N	Penang	\N	\N	0.5	60	Other	OPEN	1	2026-05-30 14:20:00+00	/media/task_0cd69a25-5937-407a-a71c-19a093bd5422.jpg	2026-05-19 14:20:19.329471+00	2026-05-19 14:20:19.634172+00	\N	\N
abeae079-83e1-403e-a1a1-7e8fba3921f3	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test999	test999	test999	Bandar Kinrara	\N	\N	0.15	120	Cleaning	COMPLETED	1	2026-05-18 07:57:00+00	\N	2026-05-18 07:56:06.705748+00	2026-05-22 06:48:19.681855+00	\N	\N
65df4c98-62c0-4822-b913-befe89b71d11	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test000	test000	test000	KLEC	\N	\N	0.88	480	Cleaning	OPEN	1	2026-05-22 06:51:00+00	\N	2026-05-22 06:50:27.958186+00	2026-05-22 06:50:27.958186+00	\N	\N
a18f5eef-0748-4c12-a10d-65fc81653e40	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test222	test222	test222	Serenia	\N	\N	2	10	Security	COMPLETED	1	2026-05-18 07:18:00+00	/media/task_a18f5eef-0748-4c12-a10d-65fc81653e40.jpeg	2026-05-18 07:16:28.460702+00	2026-05-18 07:29:59.559913+00	\N	\N
768d8c9c-9d71-4102-aeee-5687cf3d4085	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test111	test111	test111	KLEC	\N	\N	0.56	120	Cleaning	OPEN	1	2026-05-22 06:59:00+00	\N	2026-05-22 06:58:34.221021+00	2026-05-22 06:58:34.221021+00	\N	\N
3c04e309-f1fe-4c02-8f1d-44545cd6b43c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test123	test123	test123	Glenmarie	\N	\N	0.99	120	Security	OPEN	1	2026-05-22 07:03:00+00	\N	2026-05-22 07:01:09.139691+00	2026-05-22 07:01:09.139691+00	\N	\N
c93c6d77-beb9-42c6-8671-48e39107fa46	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test222	test222	test222	KLEC	\N	\N	0.55	120	Cleaning	OPEN	1	2026-05-22 07:05:00+00	/media/task_c93c6d77-beb9-42c6-8671-48e39107fa46.webp	2026-05-22 07:04:59.547412+00	2026-05-22 07:05:00.30053+00	\N	\N
61858d49-54d5-42d7-b2f9-4464ec0e8fdf	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test000	test000	test000	KLEC	\N	\N	0.88	480	Cleaning	COMPLETED	1	2026-05-22 06:54:00+00	/media/task_61858d49-54d5-42d7-b2f9-4464ec0e8fdf.jpeg	2026-05-22 06:50:45.080421+00	2026-05-22 07:14:12.373313+00	\N	\N
cec4404c-618c-4a38-a389-87da7b2f5e4d	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testtest	testest	testtest	kl	\N	\N	0.89	3	Cleaning	COMPLETED	1	2026-05-22 07:11:00+00	/media/task_cec4404c-618c-4a38-a389-87da7b2f5e4d.webp	2026-05-22 07:07:52.30298+00	2026-05-22 07:13:22.124065+00	\N	\N
76a26938-619e-4a4b-8154-5cf76293497c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	0.5	120	Cleaning	COMPLETED	1	2026-06-05 03:06:00+00	/media/task_76a26938-619e-4a4b-8154-5cf76293497c.jpg	2026-06-04 03:06:25.305096+00	2026-06-04 03:17:35.863184+00	\N	\N
ace2ac19-19bd-496f-935a-bfa2382d3dbe	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test111	test111	test111	Bangsar	\N	\N	0.77	120	Cleaning	COMPLETED	1	2026-05-22 14:54:00+00	/media/task_ace2ac19-19bd-496f-935a-bfa2382d3dbe.png	2026-05-22 06:53:54.545581+00	2026-06-04 03:07:40.801037+00	\N	\N
7ec1de4b-ad98-4a6b-b945-50b1235c909c	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	20000	2	Cleaning	COMPLETED	1	2026-06-24 07:43:00+00	/media/task_7ec1de4b-ad98-4a6b-b945-50b1235c909c.png	2026-06-24 07:38:09.70071+00	2026-06-24 07:41:21.278007+00	\N	\N
a9f98e44-6b5e-4e6e-a163-d2e8d76601f8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	t6yui	fghjk	fghjk,l	kl	\N	\N	0.67	3	Cleaning	CANCELLED	1	2026-06-10 08:01:00+00	/media/task_a9f98e44-6b5e-4e6e-a163-d2e8d76601f8.png	2026-06-10 07:59:11.545312+00	2026-06-25 07:02:48.893015+00	\N	\N
83056254-de14-4e73-978c-817a17d6953b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	data collection for crafting	tets	have own transport	BK5	\N	\N	0.16667	140	Other	IN_PROGRESS	1	2026-06-27 01:00:00+00	/media/task_83056254-de14-4e73-978c-817a17d6953b.png	2026-06-26 06:30:47.471321+00	2026-06-26 06:31:26.283436+00	\N	\N
ca82eb96-34d1-43ad-bc42-a30661bb02b7	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ttt	ttt	ttt	ttt	\N	\N	0.5	2	Cleaning	COMPLETED	1	2026-06-10 08:06:00+00	/media/task_ca82eb96-34d1-43ad-bc42-a30661bb02b7.png	2026-06-10 08:04:57.527045+00	2026-06-10 08:08:32.626587+00	\N	\N
35d43768-a605-4bac-82f5-2e7029e916b8	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Arranging goods to the rack	loading & unloading items in a retails shop	Must able to use both hands, can walk as per normal human	KL Eco City	\N	\N	0.4	480	Other	IN_PROGRESS	5	2026-07-13 01:00:00+00	/media/task_35d43768-a605-4bac-82f5-2e7029e916b8.jpeg	2026-07-06 14:22:52.216021+00	2026-07-07 14:35:26.143678+00	\N	\N
0ffe0c1c-ae5c-4b3d-996b-42bfef0bd088	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testtimer	testtimer	testtimer	testtimer	\N	\N	0.5	2	Cleaning	COMPLETED	1	2026-06-04 04:06:00+00	/media/task_0ffe0c1c-ae5c-4b3d-996b-42bfef0bd088.webp	2026-06-04 04:03:57.426142+00	2026-06-04 04:10:22.077228+00	\N	\N
dbeabfde-3496-4589-9868-3df960931496	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testmobile	testmobile	testmobile	testmobile	\N	\N	0.1	1	Cleaning	COMPLETED	1	2026-06-25 07:43:00+00	/media/task_dbeabfde-3496-4589-9868-3df960931496.png	2026-06-24 07:43:37.348764+00	2026-06-24 07:46:27.920932+00	\N	\N
b76b9fc1-d6af-4328-a0c4-fbb6addcd431	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	TEST KKKK	TEST KKKK	TEST KKKK	KL	\N	\N	0.6	120	Repair	IN_PROGRESS	2	2026-07-07 13:01:00+00	/media/task_b76b9fc1-d6af-4328-a0c4-fbb6addcd431.jpg	2026-07-06 13:02:02.28634+00	2026-07-06 13:03:22.117306+00	\N	\N
13a98f0a-a7ea-41d3-922b-7049302b2c3e	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	aaa	aaa	aaa	aaa	\N	\N	0.2	2	Cleaning	COMPLETED	1	2026-06-10 08:10:00+00	/media/task_13a98f0a-a7ea-41d3-922b-7049302b2c3e.png	2026-06-10 08:06:38.798978+00	2026-06-10 08:13:58.983319+00	\N	\N
0f435d3e-3291-4f63-b794-e09a0a4029dc	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	0.5	1	Cleaning	COMPLETED	1	2026-06-04 03:20:00+00	/media/task_0f435d3e-3291-4f63-b794-e09a0a4029dc.webp	2026-06-04 03:18:20.350218+00	2026-06-04 06:22:27.15723+00	\N	\N
2cba6f3b-9370-48eb-837c-54c8d1a384aa	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	quick fix web page C	quick fix web page C	\N	Penang	\N	\N	0.5	5	Other	COMPLETED	1	2026-06-08 03:51:00+00	\N	2026-06-07 03:51:53.023537+00	2026-06-07 04:00:10.924076+00	\N	\N
51581b4c-6ec0-4a03-adb2-3be79875244a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	quick fix for web page D	quick fix for web page D	\N	Penang	\N	\N	0.5	2	Other	COMPLETED	1	2026-06-08 04:10:00+00	\N	2026-06-07 04:10:58.373524+00	2026-06-07 04:15:25.938382+00	\N	\N
6e5ef224-e229-46e2-9d2b-15ac3ec1d054	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	ghhjkjkll	vnbmn,.,/.	bnm,.	bnmk	\N	\N	0.67	5	Cleaning	CANCELLED	1	2026-06-10 07:48:00+00	/media/task_6e5ef224-e229-46e2-9d2b-15ac3ec1d054.png	2026-06-10 07:46:09.605588+00	2026-06-25 08:00:50.095033+00	\N	\N
82e328ee-42f1-4caf-bb18-b5b136e78a5b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test67	test67	test67	kl	\N	\N	0.67	2	Cleaning	COMPLETED	1	2026-06-10 07:34:00+00	/media/task_82e328ee-42f1-4caf-bb18-b5b136e78a5b.webp	2026-06-10 07:32:07.451383+00	2026-06-10 07:36:45.519662+00	\N	\N
27f1a15c-92b0-4b71-8a7d-8631bc5cd393	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testmobile	testmobile	testmobile	testmobile	\N	\N	0.9	2	Cleaning	CANCELLED	1	2026-06-24 07:49:00+00	/media/task_27f1a15c-92b0-4b71-8a7d-8631bc5cd393.png	2026-06-24 07:48:14.679008+00	2026-06-24 07:51:53.835886+00	\N	\N
86edd7e3-4912-476e-ba56-b94f81914b9f	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test123	test123	test123	test123	\N	\N	0.99	3	Cleaning	COMPLETED	1	2026-06-24 06:59:00+00	/media/task_86edd7e3-4912-476e-ba56-b94f81914b9f.png	2026-06-24 06:56:14.034057+00	2026-06-24 06:59:42.187046+00	\N	\N
9c46be04-759b-4c02-8c09-0a0e0baa3cc2	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test99	test99	test99	test99	\N	\N	0.99	1	Cleaning	CANCELLED	1	2026-06-04 06:38:00+00	/media/task_9c46be04-759b-4c02-8c09-0a0e0baa3cc2.webp	2026-06-04 06:35:32.724579+00	2026-06-25 08:00:52.670954+00	\N	\N
fff30804-5762-4039-a8bf-c585d8fbb20d	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	10	2	Cleaning	COMPLETED	1	2026-06-24 08:02:00+00	/media/task_fff30804-5762-4039-a8bf-c585d8fbb20d.png	2026-06-24 07:02:59.65364+00	2026-06-24 07:05:43.459652+00	\N	\N
bbdae445-6ded-441b-80e9-f023ac17f290	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	testmobile	testmobile	testmobile	testmobile	\N	\N	12	4	Cleaning	COMPLETED	1	2026-06-24 08:06:00+00	/media/task_bbdae445-6ded-441b-80e9-f023ac17f290.png	2026-06-24 08:04:51.029471+00	2026-06-24 08:10:12.362209+00	\N	\N
37fe1bcd-6cee-434f-8ea1-993ae6b9faa2	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	t	t	t	t	\N	\N	100	3	Cleaning	COMPLETED	1	2026-06-24 12:07:00+00	/media/task_37fe1bcd-6cee-434f-8ea1-993ae6b9faa2.png	2026-06-24 07:07:07.138392+00	2026-06-24 07:11:21.294365+00	\N	\N
ed306b07-1f3d-4d7d-b9e0-c0e856ba7f8a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	TEST	TESTP	TESTP	TESTP	\N	\N	0.88	10	Cleaning	CANCELLED	2	2026-06-04 06:20:00+00	/media/task_ed306b07-1f3d-4d7d-b9e0-c0e856ba7f8a.webp	2026-06-04 06:13:40.651175+00	2026-06-25 08:00:54.804744+00	\N	\N
7507176e-1403-4153-a6eb-ff87c9effa63	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test122	test122	test122	test	\N	\N	0.5	120	Cleaning	CANCELLED	1	2026-06-04 03:57:00+00	/media/task_7507176e-1403-4153-a6eb-ff87c9effa63.jpg	2026-06-04 03:55:08.479781+00	2026-06-25 08:00:57.363494+00	\N	\N
eae56c0f-e54d-42fb-a805-726cf0bedc32	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	10	1	Cleaning	COMPLETED	1	\N	/media/task_eae56c0f-e54d-42fb-a805-726cf0bedc32.png	2026-06-25 04:38:40.585195+00	2026-06-25 04:40:56.304837+00	\N	\N
260071d4-3bdd-4e0d-ad17-cb272e94a21b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test111	test111	test111	test111	\N	\N	0.99	2	Cleaning	COMPLETED	1	2026-06-27 08:11:00+00	/media/task_260071d4-3bdd-4e0d-ad17-cb272e94a21b.png	2026-06-24 08:11:53.505271+00	2026-06-24 08:15:44.328186+00	\N	\N
d780a6a1-3d4c-4cb2-83c9-66d9b5de2537	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test123	test123	test123	test	\N	\N	0.5	120	Cleaning	CANCELLED	1	2026-06-04 03:31:00+00	/media/task_d780a6a1-3d4c-4cb2-83c9-66d9b5de2537.jpg	2026-06-04 03:26:59.797493+00	2026-06-25 08:01:00.849362+00	\N	\N
5476870a-7dc2-4dca-b274-5c6430963887	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	tt	tt	tt	tt	\N	\N	0.9	2	Cleaning	CANCELLED	1	2026-06-26 08:17:00+00	/media/task_5476870a-7dc2-4dca-b274-5c6430963887.png	2026-06-24 08:17:38.518036+00	2026-06-25 07:02:23.407536+00	\N	\N
2251975a-557a-4e34-a5c4-7bfa41f9a179	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	data collection at MW 	jnajldxnjlc 	need to wear socks have own transport 	Puchong Perdana 5	\N	\N	0.16667	480	Cleaning	CANCELLED	4	2026-06-26 01:00:00+00	/media/task_2251975a-557a-4e34-a5c4-7bfa41f9a179.png	2026-06-25 04:22:09.362642+00	2026-06-25 07:02:44.596459+00	\N	\N
52abd215-7c80-4fe8-8b30-391b67c2f2a2	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	qwsdefrv	sqdwcfev	sqdefvd 	kl	\N	\N	0.55	4	Cleaning	CANCELLED	1	2026-06-10 08:16:00+00	/media/task_52abd215-7c80-4fe8-8b30-391b67c2f2a2.png	2026-06-10 08:14:37.633809+00	2026-06-25 07:02:47.254994+00	\N	\N
e5d2b26e-48a5-4191-905a-318e259c551b	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	Cook Chicken Chop	Cook 20 chicken chop 	Have experience in cooking 	Puchong 	\N	\N	1	10	Cooking	CANCELLED	3	2026-05-17 23:45:00+00	/media/task_e5d2b26e-48a5-4191-905a-318e259c551b.jpg	2026-05-18 06:41:42.129633+00	2026-06-25 08:01:15.390843+00	\N	\N
f80cc3a4-4dfd-47f6-b57f-d4dce3bf0b96	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	dejkkncje	ededc	ef	fcde	\N	\N	50	1	Cleaning	COMPLETED	1	\N	\N	2026-07-06 13:04:06.822438+00	2026-07-06 13:06:54.230136+00	\N	\N
0611dc85-77bc-449d-ba62-9c3855f45be5	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	test	\N	\N	0.7	2	Cleaning	COMPLETED	1	2026-07-08 01:40:00+00	/media/task_0611dc85-77bc-449d-ba62-9c3855f45be5.webp	2026-07-08 01:38:14.569826+00	2026-07-10 01:19:20.652566+00	\N	\N
b050ceb2-95b8-4122-bba0-bb44d33d4c6a	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test2	test2	test2	test2	\N	\N	0.88	3	Cleaning	COMPLETED	1	2026-07-09 01:38:00+00	/media/task_b050ceb2-95b8-4122-bba0-bb44d33d4c6a.webp	2026-07-08 01:38:46.477989+00	2026-07-10 01:24:46.548109+00	\N	\N
7b6c6c28-070b-4218-b4c3-1e40fbff59a1	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	a	a	a	a	\N	\N	0.16666666666666666	60	Cleaning	COMPLETED	1	\N	\N	2026-07-10 03:31:37.074653+00	2026-07-10 07:47:01.909615+00	1f1c28c4-e447-4df6-9a9c-fa5b4e93e6c7	\N
02c5f7cf-2c93-4890-a974-aea3b55c4bce	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	test	test	test	kl	\N	\N	0.5	1	Cleaning	COMPLETED	1	\N	/media/task_02c5f7cf-2c93-4890-a974-aea3b55c4bce.png	2026-06-26 06:42:42.436752+00	2026-07-10 13:23:01.881351+00	\N	\N
a43ed828-7a42-48b7-97bb-516963c7efad	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	data collection 	test	x	kl	\N	\N	0.16666666666666666	30	Moving	COMPLETED	1	\N	\N	2026-07-10 07:56:56.951467+00	2026-07-10 07:58:58.502208+00	1f1c28c4-e447-4df6-9a9c-fa5b4e93e6c7	\N
d97993ae-0b13-492a-a5ed-ff728ec354f3	24d9a86a-879f-4d18-a08c-2ee915c11b58	tc	tc	tc	pc	\N	\N	0.16666666666666666	60	Moving	COMPLETED	1	\N	\N	2026-07-10 13:34:56.349427+00	2026-07-10 13:36:28.307328+00	d7e69a73-bc94-4eae-9b67-07640116a64b	MW
34c5eab5-c49b-448a-aa9a-a5258c07fc27	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	add	a	d	kl	\N	\N	0.16666666666666666	60	Cleaning	IN_PROGRESS	1	\N	\N	2026-07-10 13:29:15.961681+00	2026-07-10 13:46:58.362463+00	3589f24c-0740-4e40-8fbc-0d425303c977	\N
8cf9d55c-d09a-4128-8f28-759ef651037a	24d9a86a-879f-4d18-a08c-2ee915c11b58	MW C DC	MW C DC	MW C DC	Puchong	\N	\N	0.15	60	Cleaning	CANCELLED	1	\N	\N	2026-07-10 13:28:42.765292+00	2026-07-10 13:51:46.786442+00	d7e69a73-bc94-4eae-9b67-07640116a64b	MW
630f3f60-d74f-48cb-a37c-0a2e7af2e7b6	4e252a5b-389f-4648-933c-e95b5fc99f40	abc	abc	abc	abc	\N	\N	0.16666666666666666	60	Cleaning	COMPLETED	1	\N	\N	2026-07-10 13:42:40.794093+00	2026-07-10 13:43:18.363254+00	54e92380-d479-41d5-b8dc-bed30fe22003	BHP
a48cbcff-3b1b-405b-911d-50c7a5d545c7	24d9a86a-879f-4d18-a08c-2ee915c11b58	kk	kk	kkk	kkk	\N	\N	0.03333333333333333	540	Delivery	COMPLETED	1	\N	\N	2026-07-10 13:43:35.230084+00	2026-07-10 13:45:19.860297+00	d7e69a73-bc94-4eae-9b67-07640116a64b	MW
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, user_id, type, amount, description, reference_id, created_at) FROM stdin;
3f6b5428-916a-4c9f-be87-028aeaecad31	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	1707.38	Earnings from task: System Debugger 	884ec733-a01b-408d-af88-595f87527f48	2026-05-10 02:51:33.734443+00
33a4a61c-3e0b-4d79-abac-31cc73d2db4e	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-0.01	Withdrawal request to FarhanBank ···3456	c81c669c-30cd-4a92-b6b9-bb502a29c3a3	2026-05-10 03:15:16.272155+00
be54a433-d68e-4117-a6fc-ac42b0a4f5e3	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_COMPLETED	-0.01	Withdrawal approved to FarhanBank ···3456	c81c669c-30cd-4a92-b6b9-bb502a29c3a3	2026-05-10 03:15:30.139247+00
441be63f-94d9-404f-9876-56e98a16eaa8	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-10	Withdrawal request to FarhanBank ···3456	c6ccb311-7d3e-449f-83c1-366809a140c3	2026-05-10 04:07:14.175367+00
297fe539-9ffe-4e8b-a998-f6aa15456ae8	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to FarhanBank ···3456	c6ccb311-7d3e-449f-83c1-366809a140c3	2026-05-10 04:07:47.579471+00
6ad7453b-714e-4586-b9ca-92dd4d15d603	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	17.24	Earnings from task: Food Delivery 	d80bc371-994b-4128-896d-8c53acebab40	2026-05-10 04:31:07.18813+00
6d8e1172-e2c4-42ca-ab24-45217ed77111	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	5.239999999999998	Time adjustment by admin (session d80bc371…) Reason: Did not have proof of completion	d80bc371-994b-4128-896d-8c53acebab40	2026-05-10 04:35:42.323673+00
59b9aff0-fa84-497c-bfde-ef38fd5c6fda	fe9220e1-1e1d-43b3-864f-e65cec183c90	CREDIT	10.24	Earnings from task: quick fix web page bug A	ac87dfee-db0f-4c8f-873e-cf718d4be6bb	2026-05-13 09:02:09.923703+00
dbc943f3-e48c-4755-92cd-7e29326c6f21	fe9220e1-1e1d-43b3-864f-e65cec183c90	CREDIT	5.27	Earnings from task: quick fix web page B	0e85da91-2cbb-4f1e-b7f8-8f7e21c707d8	2026-05-13 09:11:45.010397+00
47c28cc2-3ca5-4be4-81f6-480e2cde1d25	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	CREDIT	6007.14	Earnings from task: System Debugger 	39142fc4-a1d3-4c1e-b312-e5db14c15d4f	2026-05-15 01:24:21.716188+00
004abd66-7fa3-45f2-b088-23b54225ac0b	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-1700	Withdrawal request to FarhanBank ···3456	e2f26358-28a6-4db9-b29b-be6e9fa3ec68	2026-05-15 02:24:18.477536+00
bcb8e6ee-71df-4847-a4dd-feb3a20466d6	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_REJECTED	1700	Withdrawal rejected — RM 1700.00 refunded to wallet	e2f26358-28a6-4db9-b29b-be6e9fa3ec68	2026-05-15 02:25:18.179701+00
e2306ca6-59ca-4754-bfc5-761b0470fab2	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-1700	Withdrawal request to FarhanBank ···3456	8fdd7033-81c3-463b-afbf-39f2162bed6b	2026-05-15 02:25:33.756328+00
8f2117a2-f561-42cd-88a7-05086095eb45	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_COMPLETED	-1700	Withdrawal approved to FarhanBank ···3456	8fdd7033-81c3-463b-afbf-39f2162bed6b	2026-05-15 02:26:24.021521+00
4a84eba5-5360-43e7-a65f-26d44591f6c8	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	6.73	Earnings from task: Window Cleaning	c1e5218e-9804-4fb9-947b-72def093ff2e	2026-05-15 03:00:01.157786+00
f3d48283-64a7-4918-947b-9a4802c896f8	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	WITHDRAWAL_PENDING	-10	Withdrawal request to Bank ···1000	92b594ef-9ed4-4813-9afc-ae1348448a29	2026-05-15 03:01:09.477963+00
6ecf3f8c-0e14-4df8-a630-c42158f9b735	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to Bank ···1000	92b594ef-9ed4-4813-9afc-ae1348448a29	2026-05-15 03:02:01.950231+00
90db0def-f9d3-4341-a535-512774416175	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	11.53	Earnings from task: ee	d7e5b841-10e1-4b6c-82c7-8871dc245617	2026-05-15 08:33:53.269517+00
2acd2ea7-2347-477d-9202-3d9b4d6c5bcb	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-12	Withdrawal request to qejobnjld ···1010	f515d251-fb4d-490c-bec9-f006c966e5ed	2026-05-15 08:34:09.413027+00
d3eaabe2-a6c2-4d07-af53-dc0306e6eddc	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-12	Withdrawal approved to qejobnjld ···1010	f515d251-fb4d-490c-bec9-f006c966e5ed	2026-05-15 08:34:42.91613+00
a06c19c3-63c5-446e-b05a-f0bff9b6ea9f	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	1066.29	Earnings from task: Baking Cookies 	3d79e3f8-5103-4e75-b16a-628a6312ecf5	2026-05-18 01:17:02.224291+00
f026e6f8-9e48-4137-a47d-22af64d27b51	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	CREDIT	3406.23	Earnings from task: Food Catering 	8676a35d-05b3-4d29-8f75-e6a0b5f056a3	2026-05-18 01:37:07.144393+00
8693bb02-3b5d-4df2-981e-4704ded6f649	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	CREDIT	16.01	Earnings from task: Math Tutor	4bdbf552-b82e-4786-bfcb-b7fe32b76042	2026-05-18 02:09:12.367654+00
6588f228-88e4-4887-9669-1c85e15db115	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	9.74	Earnings from task: Office Cleaning	faae2b5a-edf0-4d39-8633-c4fdd8ccc1df	2026-05-18 02:10:44.528405+00
ecb6dddf-b7d2-4b73-8237-9b8b657b8c69	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-16	Withdrawal request to qejobnjld ···1010	7adf09de-85b6-442f-8199-d3396bbd745b	2026-05-18 02:16:39.674032+00
2da18f2e-a2d6-407a-80f7-276a6f0610f6	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-16	Withdrawal approved to qejobnjld ···1010	7adf09de-85b6-442f-8199-d3396bbd745b	2026-05-18 02:17:10.538945+00
3f0acfbb-ccbd-4948-8f9c-f404785519c4	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	32.11	Earnings from task: macOS tuition for kid	a30c61f1-3f5a-4573-b71f-57dee2b391ca	2026-05-18 02:23:07.381935+00
d8469582-31b1-4311-a16a-1402491766b9	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	CREDIT	6.18	Earnings from task: Deliver Parcel	83c2142e-0f84-4732-9cc2-2479c2c25a57	2026-05-18 02:24:25.210665+00
73aa0d1e-0bae-4914-850b-d23718919852	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	14.73	Earnings from task: It Tutor	9cb98929-30d7-4bd6-aef3-f40b317cb555	2026-05-18 02:58:48.361708+00
aa3bb396-a0f7-48e2-a5cd-4f497acacf2e	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	5.42	Earnings from task: History Tutor	f273d686-63d2-4259-9640-0f3be52682db	2026-05-18 06:29:45.194638+00
43438372-8bcc-4d78-a830-bd8e53358c96	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	11.67	Earnings from task: Baking Cake	e388302e-adbf-4170-a6aa-647080be8920	2026-05-18 06:48:15.819894+00
51680af6-e55b-4611-9231-1c3f9edc842c	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-15.09	Withdrawal request to qejobnjld ···1010	64095856-7891-4be7-8d91-be8774573502	2026-05-18 06:49:22.428511+00
00ce35d0-14dc-4663-b367-8bcff8cd9232	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-15.09	Withdrawal approved to qejobnjld ···1010	64095856-7891-4be7-8d91-be8774573502	2026-05-18 06:50:12.037552+00
31e660d4-e6a7-4f68-b113-d4567a8b035a	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-1000	Withdrawal request to FarhanBank ···3456	831c8d73-330b-4ad5-8ca8-27d58441bca4	2026-05-18 06:51:34.893164+00
c8876db2-2998-4e6c-a74b-b050edb2f034	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_COMPLETED	-1000	Withdrawal approved to FarhanBank ···3456	831c8d73-330b-4ad5-8ca8-27d58441bca4	2026-05-18 06:51:54.128703+00
a925eced-4c54-416f-aa05-e4d4325de481	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-100	Withdrawal request to FarhanBank ···3456	ca5d09c9-fec1-49f9-8ecf-d2581d69ec1f	2026-05-18 06:57:13.521207+00
fa07c9de-2420-4492-98ba-0ee2deb8ebc9	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_REJECTED	100	Withdrawal rejected — RM 100.00 refunded to wallet	ca5d09c9-fec1-49f9-8ecf-d2581d69ec1f	2026-05-18 06:57:31.407931+00
c3ee729d-e063-4055-be95-84afe7962011	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_PENDING	-100	Withdrawal request to FarhanBank ···3456	acdcc1df-2a24-4e60-a4e2-2df5bef37ebb	2026-05-18 06:58:15.638432+00
d5b27a53-2a99-41ea-ba76-b0fb26cb5605	0e34705e-59f0-4c48-b0e2-e70184163be1	WITHDRAWAL_REJECTED	100	Withdrawal rejected — RM 100.00 refunded to wallet	acdcc1df-2a24-4e60-a4e2-2df5bef37ebb	2026-05-18 06:58:37.836221+00
9e8059e6-bfc3-4485-a16c-1b4936aa477f	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	0.82	Earnings from task: test111	58cb22fb-7da3-4418-aca0-96704bfb81ce	2026-05-18 07:12:00.240528+00
88250234-491e-4e8f-b2e3-ae143114fee1	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	26.12	Earnings from task: test222	b5a0d1dc-443a-4106-a225-6da2a267174c	2026-05-18 07:29:59.559913+00
2afedec4-db1d-4d31-b52d-b92bff45efed	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-20	Withdrawal request to qejobnjld ···1010	c223cf6d-cb48-4719-9502-b350e481df12	2026-05-18 07:52:00.382529+00
55e9cd8f-0a43-4d34-9026-9b021d755e26	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-20	Withdrawal approved to qejobnjld ···1010	c223cf6d-cb48-4719-9502-b350e481df12	2026-05-18 07:52:15.34202+00
3d3afd07-0d0b-41a4-8a5c-c5fe93d5d42b	fe9220e1-1e1d-43b3-864f-e65cec183c90	WITHDRAWAL_PENDING	-10	Withdrawal request to Maybank ···6756	0ec48587-a02d-4cb5-b972-dfb4aa7d63ed	2026-05-19 13:45:47.999007+00
5bf66912-9e7b-43ed-8922-16ab732c03f7	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	853.76	Earnings from task: test999	ccf12d7c-9416-49ca-85fd-f7933a0ec019	2026-05-22 06:48:19.681855+00
1472eb51-430b-49d6-a544-11c7e431ff52	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	2.93	Earnings from task: testtest	80eed491-24d1-49ec-8594-2ef09b175a04	2026-05-22 07:13:22.124065+00
6ea3955a-0ed7-4eb8-97f2-47ad5511c959	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	14222.12	Earnings from task: test111	4709c7b3-6497-462f-aa59-49a9c8f0568d	2026-06-04 03:07:40.801037+00
2d16c3c1-f5e6-48ce-9123-6a8202b2c14f	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	0.97	Earnings from task: test	38fd1044-48b5-44c3-8969-d4f9cfae0a98	2026-06-04 03:21:22.840453+00
dfa78d86-eb7e-45d0-a7e4-998193a0a4b6	b2c1abec-95f6-442f-99af-0ce842aacfe2	CREDIT	17392.81	Earnings from task: Office Cleaning (admin force-stopped)	c9a4497f-e966-4ba7-b05c-66199ff7b646	2026-06-04 03:58:44.925902+00
8cc96db1-96c7-43a1-a495-da21ed33bf3b	0e34705e-59f0-4c48-b0e2-e70184163be1	CREDIT	24311.47	Earnings from task: Cook Chicken Chop (admin force-stopped)	448b1beb-09c1-40b8-a6ff-9f69330db9fc	2026-06-04 03:58:51.499181+00
707119c1-8590-41b3-a528-52062e7cb51e	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	2.3	Earnings from task: testtimer	2214a75b-048e-4113-b87a-da2c773f42c8	2026-06-04 04:10:22.077228+00
8694ea02-daa1-4393-b266-1428620c2c7f	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-50	Withdrawal request to qejobnjld ···1010	0aaa3edf-3d55-40a5-a96b-4724eacef0cd	2026-06-04 06:16:39.943059+00
86062de4-bb06-4dd3-8cf0-80ef9301f944	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_REJECTED	50	Withdrawal rejected — RM 50.00 refunded to wallet	0aaa3edf-3d55-40a5-a96b-4724eacef0cd	2026-06-04 06:16:48.887552+00
bfab54dc-41ac-4e4d-90fe-fb2ca0e65ce3	fe9220e1-1e1d-43b3-864f-e65cec183c90	CREDIT	3.54	Earnings from task: quick fix web page C	78a4261e-2dd6-4e11-be01-572de08b336d	2026-06-07 04:00:10.924076+00
15de98bf-e601-4b54-bb36-014a2d0756b3	fe9220e1-1e1d-43b3-864f-e65cec183c90	CREDIT	1	Earnings from task: quick fix for web page D	5a9e680c-1e18-41b5-900a-d2087413219b	2026-06-07 04:15:25.938382+00
df2ae6e8-1a30-4167-9227-3a657fbc1ac1	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	1.34	Earnings from task: test67	6762eb91-2291-4270-8721-9ae61ed9223c	2026-06-10 07:36:45.519662+00
4418c367-d8fb-4464-b61f-4e577ebc2737	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	CREDIT	7677.69	Earnings from task: TEST (admin force-stopped)	da52f805-b0bf-426e-80d2-2115a7b7a130	2026-06-10 07:45:29.207602+00
b39a1ead-b94e-4a02-b6e0-4e86e0a19e2f	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	1	Earnings from task: ttt	93cecfb3-ffef-409f-b3fe-44e9ea4e8ada	2026-06-10 08:08:32.626587+00
42f16b8b-249c-4d0c-b108-77f4994fe04d	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	0.4	Earnings from task: aaa	87a5baf6-50df-4b9f-8e16-53658773a986	2026-06-10 08:13:58.983319+00
663a9ed1-e69f-42b8-aed1-be1941e8d7eb	7e438196-958b-4cb5-831c-0027b8a009cb	CREDIT	2.97	Earnings from task: test123	2ba73b6f-81b6-4611-9c24-898668723939	2026-06-24 06:59:42.187046+00
c5609d4f-c99d-4b2d-b6f3-ced1e66d1ad7	7e438196-958b-4cb5-831c-0027b8a009cb	CREDIT	20	Earnings from task: test	bc57452e-fc2d-4417-999d-81e3d15fbb80	2026-06-24 07:05:43.459652+00
ebe857dc-9e31-4bbb-9d14-9f8e9de56a56	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_PENDING	-10	Withdrawal request to CIMB Bank ···2345	df4daf4c-09ab-4de1-af2b-684278769002	2026-06-24 07:05:58.127977+00
9d398606-9464-4d52-8228-ead11f3006ba	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to CIMB Bank ···2345	df4daf4c-09ab-4de1-af2b-684278769002	2026-06-24 07:06:12.352587+00
8d8b3a3a-d069-4f28-990e-67ddfa677f84	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_PENDING	-10	Withdrawal request to CIMB Bank ···2345	6ece5806-bb3c-4ee8-90a4-363d8f7d8d89	2026-06-24 07:06:23.927023+00
d3f014d8-5064-4f0a-9721-69971ff200d2	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to CIMB Bank ···2345	6ece5806-bb3c-4ee8-90a4-363d8f7d8d89	2026-06-24 07:06:32.019063+00
91d3fc98-a214-4b3e-865b-8e20064b95b9	7e438196-958b-4cb5-831c-0027b8a009cb	CREDIT	300	Earnings from task: t	026b4673-c8d2-40e7-8968-974a34d3da7a	2026-06-24 07:11:21.294365+00
cb3db696-71dc-4236-90da-3dde45fe2e1c	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_PENDING	-20	Withdrawal request to CIMB Bank ···2345	cfa01078-fe7d-4e0b-88d4-bc2c1152ca7e	2026-06-24 07:11:28.242971+00
3d9831ae-70ac-44d8-9f9b-e5b55c9c4093	7e438196-958b-4cb5-831c-0027b8a009cb	WITHDRAWAL_REJECTED	20	Withdrawal rejected — RM 20.00 refunded to wallet	cfa01078-fe7d-4e0b-88d4-bc2c1152ca7e	2026-06-24 07:11:34.096369+00
40f3523d-b6f4-4084-ae4d-29537f7ea201	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	40000	Earnings from task: test	749c9b40-b62a-4b9d-977e-1dd9a8e95b07	2026-06-24 07:41:21.278007+00
0b347751-f233-4172-95ae-99a0a18889fd	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_PENDING	-1000	Withdrawal request to Maybank ···9012	83c24815-9381-408e-afec-be2528cf3e67	2026-06-24 07:42:42.976514+00
38ae08d8-d773-43d8-9447-79052fa0de9c	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_COMPLETED	-1000	Withdrawal approved to Maybank ···9012	83c24815-9381-408e-afec-be2528cf3e67	2026-06-24 07:42:54.168513+00
47ff1c88-16b0-4403-a7d1-7c2f8428e718	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	0.1	Earnings from task: testmobile	ee0770e0-7a40-46a6-aedc-ab4260dd2710	2026-06-24 07:46:27.920932+00
460b487d-6497-4812-bdea-54237ad3d52b	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	48	Earnings from task: testmobile	d7b54b5c-dc2f-4d5d-927f-7f8fb76eab08	2026-06-24 08:10:12.362209+00
16e16ac6-51ea-4701-b560-4240a74715a1	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-1000	Withdrawal request to qejobnjld ···1010	f1116de2-e8d0-4e44-932d-33171704134a	2026-06-24 08:10:43.801879+00
51147a7b-9488-4d61-bf2c-c0ae51ed0dea	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-1000	Withdrawal approved to qejobnjld ···1010	f1116de2-e8d0-4e44-932d-33171704134a	2026-06-24 08:11:04.48663+00
39f8b048-fa90-4a02-a6ba-1512d8cfe8a3	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	1.98	Earnings from task: test111	194346ce-3219-4db5-8616-bcb071548543	2026-06-24 08:15:44.328186+00
dc266a05-791a-4f13-9cae-58e0af6f259e	fe9220e1-1e1d-43b3-864f-e65cec183c90	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to Maybank ···6756	0ec48587-a02d-4cb5-b972-dfb4aa7d63ed	2026-06-25 04:15:32.148742+00
b2f39da2-3672-424d-9ef0-93bcf12cbfad	067c11cc-f14f-439a-a673-c48b7b210aa1	CREDIT	10	Earnings from task: test	915d6476-52b1-44ae-bdb1-43a292333d84	2026-06-25 04:40:56.304837+00
1a9f5569-a6ec-43b7-9217-16793ba90a0c	067c11cc-f14f-439a-a673-c48b7b210aa1	WITHDRAWAL_PENDING	-10	Withdrawal request to Maybank ···9012	aaa89d5e-0e43-4845-94b9-5a5b34347064	2026-06-25 04:42:20.759836+00
19274dbb-0ba8-4959-8a47-08d377cd53e4	067c11cc-f14f-439a-a673-c48b7b210aa1	WITHDRAWAL_REJECTED	10	Withdrawal rejected — RM 10.00 refunded to wallet	aaa89d5e-0e43-4845-94b9-5a5b34347064	2026-06-25 04:42:37.974233+00
7694d529-4875-4258-95d2-00cca721bf49	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	1209.53	Earnings from task: tt (admin force-stopped)	a8958c00-6839-413a-9a56-73b2d4a7d901	2026-06-25 06:42:23.995351+00
b52afd45-6258-42d6-b719-0da274a6c1a1	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	2.79	Earnings from task: data collection at MW  (admin force-stopped)	d0a71f08-98f9-4114-b121-25a6529012b5	2026-06-25 07:02:38.346211+00
69dfbf3a-2b36-4d4b-9ead-81c77a5cb1a9	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-100	Withdrawal request to qejobnjld ···1010	30c1c0d1-c7ba-41d2-afbd-99c0dc90575f	2026-06-25 07:55:50.684586+00
638b7094-5988-412a-8503-4bf58208a8f2	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-100	Withdrawal approved to qejobnjld ···1010	30c1c0d1-c7ba-41d2-afbd-99c0dc90575f	2026-06-25 07:56:04.319495+00
2921c136-29ea-4dc6-84cc-ed8c059ba46e	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-119	Withdrawal request to Hong Leong Bank ···1234	75d42f6c-1e99-4892-997d-37d122dabaf1	2026-06-25 07:57:49.791311+00
042a75b4-9d2c-4f89-97cb-861bbfd4fe5f	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-119	Withdrawal approved to Hong Leong Bank ···1234	75d42f6c-1e99-4892-997d-37d122dabaf1	2026-06-25 07:57:59.514933+00
642c7384-4726-43a5-95d4-47c65643e673	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-119	Withdrawal request to Hong Leong Bank ···1234	70b91003-1eba-4dde-9f15-5fb8ea53fd4b	2026-06-25 07:58:55.568918+00
9049d7a1-fc2d-4613-a840-852e0153eeac	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-119	Withdrawal approved to Hong Leong Bank ···1234	70b91003-1eba-4dde-9f15-5fb8ea53fd4b	2026-06-25 08:00:11.393382+00
7cb830da-bf3c-48e5-8a75-2f7ee52a90e6	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-100	Withdrawal request to Hong Leong Bank ···1234	e68595b5-c010-42bf-b886-0b5a250bd701	2026-06-26 06:38:40.668967+00
d1c6d445-f234-4a98-8092-bcebe176fa94	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_REJECTED	100	Withdrawal rejected — RM 100.00 refunded to wallet	e68595b5-c010-42bf-b886-0b5a250bd701	2026-06-26 06:39:09.113955+00
2f443fee-80f7-491b-91df-2daa02ec0d60	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_PENDING	-10	Withdrawal request to Hong Leong Bank ···1234	05aa72d1-470c-48ab-a10c-2918c59b6410	2026-06-26 06:39:29.262868+00
4faa8262-b6ae-4890-a445-1b8b7ab26d7c	1d1be295-3305-4397-b9fb-dac021af69b0	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to Hong Leong Bank ···1234	05aa72d1-470c-48ab-a10c-2918c59b6410	2026-06-26 06:39:41.506706+00
461729cd-c0d0-46c2-8185-79a0ee2d2d9c	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	0.5	Earnings from task: test	29de6efd-d4f3-4c49-a63a-ce4428dda75b	2026-06-26 06:44:15.154693+00
5346481a-47af-4d0f-a538-b788ceb97fd0	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_PENDING	-38000	Withdrawal request to Maybank ···9012	8681fdde-657c-4329-a04e-d20c170498f6	2026-06-26 07:31:13.19476+00
b53f26ad-c5c5-4d90-8bea-d6dd0a8fc304	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_COMPLETED	-38000	Withdrawal approved to Maybank ···9012	8681fdde-657c-4329-a04e-d20c170498f6	2026-06-26 07:31:37.427293+00
a605459d-80f9-4418-aefc-b86a9d55191e	a5ed9b09-88c3-453f-8db1-75e8773a7344	CREDIT	50	Earnings from task: dejkkncje	2c4f04c9-341d-4b12-8544-0b4a65067dab	2026-07-06 13:06:54.230136+00
ff44edd4-27af-4ec9-b569-74ba958c29eb	a5ed9b09-88c3-453f-8db1-75e8773a7344	WITHDRAWAL_PENDING	-50	Withdrawal request to CIMB Bank ···3412	eaf9b2c4-c069-4999-ab2a-d6a76b5c1978	2026-07-06 13:07:34.462638+00
185ce2a7-055f-4d7b-a1f1-a76d9f958b02	a5ed9b09-88c3-453f-8db1-75e8773a7344	WITHDRAWAL_COMPLETED	-50	Withdrawal approved to CIMB Bank ···3412	eaf9b2c4-c069-4999-ab2a-d6a76b5c1978	2026-07-06 13:07:43.193194+00
5732d2d2-59b5-43af-b8a6-f9c5ba705809	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	1.4	Earnings approved for task: test	15b2b5a8-a2bf-44eb-b3c7-d71a4eef9fb5	2026-07-10 01:19:20.652566+00
9d7828d3-baec-4d85-afd3-a85e6582febf	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_PENDING	-10	Withdrawal request to Maybank ···9012	247cb2ed-bf95-4bd8-a459-b9c9b1060cd8	2026-07-10 01:19:44.58583+00
82d3aca6-4c1d-4e42-b4d4-6500592fc68d	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to Maybank ···9012	247cb2ed-bf95-4bd8-a459-b9c9b1060cd8	2026-07-10 01:19:53.299751+00
284b1726-c808-4a68-9170-c70ab339447a	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	2.02	Earnings from task: test2 (admin force-stopped)	821532ff-2f54-4cc9-9cb0-9510423c98a2	2026-07-10 01:23:12.685673+00
33455901-f861-4f05-b9a3-c02de1685f3b	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	2.02	Earnings approved for task: test2	821532ff-2f54-4cc9-9cb0-9510423c98a2	2026-07-10 01:24:46.548109+00
52639feb-169b-4ec5-9f89-6ac51dda7791	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	0.07	Earnings approved for task: a	048fd2bb-98d7-495b-a068-3c1eaa7faede	2026-07-10 07:47:01.909615+00
4b0effc2-cc6e-400f-ac3d-7192da9b85c5	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_PENDING	-11	Withdrawal request to Maybank ···9012	9d35ad2b-955a-46d8-aea9-bf11a7974a73	2026-07-10 07:48:21.675124+00
fc0cfc0d-36e8-4419-8229-d4aac4890301	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_REJECTED	11	Withdrawal rejected — RM 11.00 refunded to wallet	9d35ad2b-955a-46d8-aea9-bf11a7974a73	2026-07-10 07:48:45.647167+00
be590ea7-4bb3-42cc-8502-d2427d9b430c	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	0.1	Earnings approved for task: data collection 	66590621-004a-4398-ab5b-711307086096	2026-07-10 07:58:58.502208+00
b2efb60d-b16f-41a0-a513-c55f50167d8a	a5ed9b09-88c3-453f-8db1-75e8773a7344	CREDIT	50	Earnings approved for task: dejkkncje	2c4f04c9-341d-4b12-8544-0b4a65067dab	2026-07-10 13:22:56.635742+00
89ce765f-3179-4ec0-9a96-f7455bb1864e	1d1be295-3305-4397-b9fb-dac021af69b0	CREDIT	0.5	Earnings approved for task: test	29de6efd-d4f3-4c49-a63a-ce4428dda75b	2026-07-10 13:23:01.881351+00
91f38298-aff6-44f0-88dd-9560a465a290	e57f811f-ddfd-406f-8050-bedf7bdacd10	CREDIT	0.01	Earnings approved for task: MW C DC	96675f78-383d-4307-9888-51c8a54a384d	2026-07-10 13:33:25.774176+00
b6d61f63-8f2d-44c3-abce-05d38f2f90e8	e57f811f-ddfd-406f-8050-bedf7bdacd10	CREDIT	0.01	Earnings approved for task: tc	6b36c21c-eb8c-4e3e-b2ff-d52d704ef18d	2026-07-10 13:36:28.307328+00
9ddc5cf3-534e-47e3-9841-badd2edfac06	e57f811f-ddfd-406f-8050-bedf7bdacd10	CREDIT	1720	Earnings approved for task: tc	6b36c21c-eb8c-4e3e-b2ff-d52d704ef18d	2026-07-10 13:39:08.276328+00
d5c847e0-1217-4311-91f3-e9d5fcf1f6e1	e57f811f-ddfd-406f-8050-bedf7bdacd10	WITHDRAWAL_PENDING	-1000	Withdrawal request to Public Bank ···1111	ea735e86-f47a-4b75-8cff-56c5a28e7143	2026-07-10 13:39:44.83494+00
d8c610c0-dd93-4e33-a0d0-407a06791fc5	e57f811f-ddfd-406f-8050-bedf7bdacd10	WITHDRAWAL_COMPLETED	-1000	Withdrawal approved to Public Bank ···1111	ea735e86-f47a-4b75-8cff-56c5a28e7143	2026-07-10 13:39:56.909184+00
4de6b2c6-e2e5-415f-a209-df08f9a11e82	2c9fb196-b062-42f1-9894-e7178ea038f6	CREDIT	0.01	Earnings approved for task: abc	6f24024d-6d58-44a7-a143-af951ecc53f2	2026-07-10 13:43:18.363254+00
38ee8892-e16a-4898-b460-0e2630580435	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_PENDING	-10	Withdrawal request to Maybank ···9012	a3b2cc24-e879-47c2-905f-26f347f08137	2026-07-10 13:43:32.70409+00
f259914a-7c84-42d6-988e-f051fed3d777	2c9fb196-b062-42f1-9894-e7178ea038f6	WITHDRAWAL_COMPLETED	-10	Withdrawal approved to Maybank ···9012	a3b2cc24-e879-47c2-905f-26f347f08137	2026-07-10 13:43:40.796442+00
c5ede13c-2f7c-4c1d-9694-6c2cb320693d	e57f811f-ddfd-406f-8050-bedf7bdacd10	CREDIT	678	Earnings approved for task: kk	434b54ca-dc99-423d-ac6b-7ba0ec1b6ca6	2026-07-10 13:45:19.860297+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, full_name, google_id, hashed_password, profile_photo_url, bio, location, latitude, longitude, skills, fcm_token, is_active, is_employer, is_admin, is_verified, created_at, updated_at, academic_qualification, body_height_cm, nationality, race, nric_passport, phone, phone_verified, bank_qr_code_url, id_photo_front_url, id_photo_back_url, selfie_with_id_url, verification_status, rejection_reason, verification_submitted_at, is_super_admin, company_tag) FROM stdin;
270c7ae3-e598-4333-9e6f-880d8faf4d6a	ENGHOO2004@GMAIL.COM	Admin	\N	42B4124xu49W4qnKgowHQN1Dg1M6U2lF4TY.TvevCdgE9u0aHf3qcoQawMGM	\N	\N	\N	\N	\N	\N	\N	t	f	t	t	2026-05-04 03:26:47.839249+00	2026-05-04 03:26:47.839249+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
fe9220e1-1e1d-43b3-864f-e65cec183c90	hazel@hazel.com	hazel	\N	$2b$12$CKriGGFo3hL5wjUiwmlPH.TOofRRiuyNpiV.9pr8.bxoI2ZXVF2Dy	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-05-04 12:18:51.905429+00	2026-05-04 12:18:51.905429+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
b2c1abec-95f6-442f-99af-0ce842aacfe2	syedemeirul@gmail.com	Syed	\N	$2b$12$UUaess6YZCxhKWI1Fzyute3w8dLFz3U3PtUx/edBLdnhUyItKIr4i	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-05-07 07:31:22.715239+00	2026-05-07 07:31:22.715239+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	aaliffauzii31@gmail.com	Alif Fauzi	\N	$2b$12$9Pie0vYFV4mSgTFHlN8z3ud23zlkFN359yY2PjFbrvZXEUg7b/cqO	\N			\N	\N	[]	\N	t	f	f	f	2026-05-07 07:42:20.407829+00	2026-05-07 07:43:06.867106+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
9c554cda-b937-4784-a17f-74ddf17fd953	enghoo@hotmail.com	eng hoo	\N	$2b$12$eVF3ERgIHHd3utIwxPpykefVNp62.LoTYyyzd0uUBmRL6TL77h4uq	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-05-16 04:23:42.137416+00	2026-05-16 04:23:42.137416+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
7e438196-958b-4cb5-831c-0027b8a009cb	syedemiooo@gmail.com	SY	\N	$2b$12$286IN.znM7RRfPPmkIyveOBlj/62RTxZZRDWOx5RXx24fTiVEfLNW	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-05-22 08:06:01.155625+00	2026-05-22 08:06:01.155625+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
2c2cee8d-4429-4931-897f-0b398427e40a	jude@gmail.com	Jude	\N	$2b$12$tB.KFl2pn4STYCF0XVWT5eUektzv6zzxj7xPWyMNrtfEpOyU64cxa	\N	bb	Puchong	\N	\N	["Tutoring"]	\N	t	f	f	t	2026-07-10 01:14:36.320171+00	2026-07-10 01:27:48.761218+00	Bachelor's Degree	186	Malaysian	Malay	123456789	123456789	f	/media/bank-qr/2c2cee8d-4429-4931-897f-0b398427e40a_bank_qr.webp	\N	\N	/media/selfies/2c2cee8d-4429-4931-897f-0b398427e40a_selfie.jpg	approved	\N	2026-07-10 01:27:42.864241+00	f	\N
1d1be295-3305-4397-b9fb-dac021af69b0	syedemeirulhabib@gmail.com	SYED EMEIRUL HABIB BIN SYED AMEEN	109023012097609113739	$2b$12$8yVt/vcrYmBpDXM5aF1qgeU91PGXOQLUj1e8jobPJDWwKoCpV0eou	/media/profiles/1d1be295-3305-4397-b9fb-dac021af69b0.webp	test	test	\N	\N	["Tech Support"]	\N	t	f	f	t	2026-05-15 01:21:32.476468+00	2026-06-24 07:49:53.657961+00	Bachelor's Degree	190	Malaysian	Malay	1234567890	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
067c11cc-f14f-439a-a673-c48b7b210aa1	henriatrifena06@gmail.com	Henria Trifena	108740986932152774760	\N	https://lh3.googleusercontent.com/a/ACg8ocLdSXvIUaGbMRDzo_s_EhPJlOmsKXO3vcaW9hTFn5S5OLHcCLtB=s96-c	\N	\N	\N	\N	\N	\N	t	f	f	t	2026-06-25 04:19:12.969497+00	2026-06-25 04:19:12.969497+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
a5ed9b09-88c3-453f-8db1-75e8773a7344	jt@mowinton.com	JT	\N	$2b$12$hzLSzC39bA4HzmYrqQDoA.sRdWQcYfAdOTXIFTnSk9i8KXIUIpyoS	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-07-06 12:59:53.219046+00	2026-07-06 12:59:53.219046+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
923dd663-1a82-4bf0-bc98-f91289dd3ce4	pengkw96@gmail.com	Kien Wei Peng	105945835531493263326	\N	https://lh3.googleusercontent.com/a/ACg8ocIdBRxDUjZl2qT56qM41R5AzTFT6BtARLldybKN6BAEA3thGA=s96-c	\N	\N	\N	\N	\N	\N	t	f	f	t	2026-07-06 14:19:41.143135+00	2026-07-06 14:19:41.143135+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
f2c26e4f-30c3-4618-a4b6-0771590958b7	kien_wei@hotmail.com	Jackson	\N	$2b$12$rVvgh6GAZSqMutVfhtC3Ge7ys3VsT9D22y5O8iLdY9MuyWH2t5gqu	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-07-07 14:34:09.11215+00	2026-07-07 14:34:09.11215+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
a8b7a957-5b3b-4012-8500-3f3d9c6e7808	abc@gmail.com	abc	\N	$2b$12$68eNUshsUMRXaHkir67Yuum.nJXpsSUwa6ZM47pve6lYw.xY0pT8e	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-07-08 13:46:37.152244+00	2026-07-08 13:46:37.152244+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
636d3ba1-cc00-4c19-8274-8111ad9cbaf8	alex@gmail.com	alex	\N	$2b$12$C6LZHO7GU4hzhlCzeK/v3uJOEAxOlgSb8FmDV8KnlkFUIXbzOHKce	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-07-09 09:34:38.826771+00	2026-07-09 09:34:38.826771+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
2c9fb196-b062-42f1-9894-e7178ea038f6	syedtest458@gmail.com	Syed Test	105811437710431909946	\N	https://lh3.googleusercontent.com/a/ACg8ocIzbpdPw8bXJ_NeDGvo5RSBLymhQ5Uxc7Cve3_JxNOedNkQlQ=s96-c	none	kl	\N	\N	["Driving"]	\N	t	f	f	t	2026-06-24 07:33:15.305118+00	2026-07-10 07:42:06.217352+00	Bachelor's Degree	186	Malaysian	Malay	123456789	6012345678	f	\N	\N	\N	\N	pending	\N	\N	f	\N
24d9a86a-879f-4d18-a08c-2ee915c11b58	jt@gmail.com	Mowinton Consulting	\N	$2b$12$fEdKZTxCUAIZfE.LdKyi.uS0MO2SwWayrC/IoVoS/tBtcW8mgt2.a	\N	\N	\N	\N	\N	\N	\N	t	f	t	t	2026-07-10 13:23:40.37997+00	2026-07-10 13:23:40.37997+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	MW
e57f811f-ddfd-406f-8050-bedf7bdacd10	jasminesheaumint@gmail.com	Du XM	105595243577994460337	\N	https://lh3.googleusercontent.com/a/ACg8ocINSaWyIUpUGQZN8Tc-qGzDDuzVFKfQVaVZSRLsKV_jZ1CJz2Y=s96-c			\N	\N	[]	\N	t	f	f	t	2026-07-08 13:51:24.739061+00	2026-07-10 13:30:22.440037+00		180			0000	016596540	f	\N	\N	\N	\N	pending	\N	\N	f	\N
01546355-e017-4717-9933-88cfa48ecd74	abu@gmail.com	abu	\N	$2b$12$9hXw2TJAw0BGpnx17h0hQeK.xjSVnoXIK1c9cgn9.QOFB5fOFm4rO	\N	ABC	KL	\N	\N	["Driving"]	\N	t	f	f	f	2026-07-09 11:01:32.379158+00	2026-07-09 11:06:26.149103+00	STPM	175.9	Malaysian 	Malay	123456789	+60123456789	f	/media/bank-qr/01546355-e017-4717-9933-88cfa48ecd74_bank_qr.webp	\N	\N	/media/selfies/01546355-e017-4717-9933-88cfa48ecd74_selfie.jpg	submitted	\N	2026-07-09 11:06:26.150291+00	f	\N
4e252a5b-389f-4648-933c-e95b5fc99f40	bhp@gmail.com	bhp	\N	$2b$12$9OlmFTRBl.5.CGE.gKNXbOY8o4r66e.PJefhU9inkC5xMPfq2qLqi	\N	\N	\N	\N	\N	\N	\N	t	f	t	t	2026-07-10 13:40:59.711669+00	2026-07-10 13:40:59.711669+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	BHP
5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	enghoo2004@gmail.com	Admin	\N	$2b$12$UvQBNi2oi9iX1fiD4K2xBeJBOFSA0B4u5hieNKZBCr5sCulAwBmcC	\N	\N	\N	\N	\N	\N	\N	t	f	t	t	2026-05-04 05:13:14.085931+00	2026-07-09 12:55:55.65676+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	t	\N
5639284a-1030-4580-8b41-ade3a1a57951	KAKAKA@gmail.com	KAKAKA	\N	$2b$12$rfRG/QvGFFplXUZJgcofrusC17pKprnWHs9RQYwiXLD7RQbkpKTLq	\N	\N	\N	\N	\N	\N	\N	t	f	f	f	2026-07-10 13:50:05.898285+00	2026-07-10 13:50:05.898285+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
e27a490d-fbfa-407b-9a85-fa628f5a8495	kakaka@gmail.com	kakaka@gmail.com	\N	$2b$12$tY3kKs6csDFgiDhyILSKdOCbjvVCVi4.ShVjbnE57MVK9J0dhXD8q	\N			\N	\N	["Tutoring"]	\N	t	f	f	t	2026-07-10 13:50:45.692246+00	2026-07-10 13:53:08.047252+00		150	na	Chinese	000	000	f	/media/bank-qr/e27a490d-fbfa-407b-9a85-fa628f5a8495_bank_qr.png	\N	\N	/media/selfies/e27a490d-fbfa-407b-9a85-fa628f5a8495_selfie.jpg	approved	\N	2026-07-10 13:53:01.421391+00	f	\N
0e34705e-59f0-4c48-b0e2-e70184163be1	fhaziqbob2002@gmail.com	Farhan	\N	$2b$12$lizKe.pg0LqwV4l95Qj3re7k38vyQ.s6BtOv1iJ0yh22nt3fD/1K6	/media/profiles/0e34705e-59f0-4c48-b0e2-e70184163be1.png		Puchong	\N	\N	["Driving", "Tech Support", "Cleaning", "Tutoring"]	\N	t	f	f	f	2026-05-07 07:49:04.219135+00	2026-07-13 01:37:34.054366+00	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pending	\N	\N	f	\N
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, user_id, available_balance, created_at, updated_at) FROM stdin;
0b7b4b1f-51df-4b51-83d6-053a9c9d25a4	7e438196-958b-4cb5-831c-0027b8a009cb	302.97	2026-05-22 08:06:02.252007+00	2026-06-24 07:11:34.096369+00
b5f72af4-1b02-4197-9608-e2bb42d7d0e0	5c38e7c9-11dc-4ffc-934e-79bd4cccdcd6	0	2026-06-24 13:47:41.707845+00	2026-06-24 13:47:41.707845+00
9e8f7a2b-149e-4809-9390-2dc99c3fbf14	9c554cda-b937-4784-a17f-74ddf17fd953	0	2026-05-16 04:23:43.345417+00	2026-05-16 04:23:43.345417+00
3cf6d0ce-adfc-43b0-b964-e13a88ea2a1c	067c11cc-f14f-439a-a673-c48b7b210aa1	10	2026-06-25 04:19:13.525423+00	2026-06-25 04:42:37.974233+00
13a7afc9-42b3-46ec-b6d3-baa2d1c5b842	923dd663-1a82-4bf0-bc98-f91289dd3ce4	0	2026-07-06 14:19:41.426315+00	2026-07-06 14:19:41.426315+00
a791ac0a-cb9e-47a8-a5b9-f59f2c7fcfe5	f2c26e4f-30c3-4618-a4b6-0771590958b7	0	2026-07-07 14:34:09.86828+00	2026-07-07 14:34:09.86828+00
6e7f6a89-f084-41ad-a571-bd2893ef9ae7	a8b7a957-5b3b-4012-8500-3f3d9c6e7808	0	2026-07-08 13:46:43.125629+00	2026-07-08 13:46:43.125629+00
51c51749-a966-4450-9b39-ba1f92068507	636d3ba1-cc00-4c19-8274-8111ad9cbaf8	0	2026-07-09 09:34:56.334575+00	2026-07-09 09:34:56.334575+00
f0ecd791-fcb0-4b33-91f4-5f61a09f14ac	01546355-e017-4717-9933-88cfa48ecd74	0	2026-07-09 11:01:50.299215+00	2026-07-09 11:01:50.299215+00
f82708f0-1fa7-4ecd-b189-005b10bc7f0f	2c2cee8d-4429-4931-897f-0b398427e40a	0	2026-07-10 01:15:20.282843+00	2026-07-10 01:15:20.282843+00
fbce60b6-c105-41da-ad63-2552a3e63e66	b2c1abec-95f6-442f-99af-0ce842aacfe2	17392.81	2026-05-07 07:31:23.670389+00	2026-06-04 03:58:44.925902+00
56866028-d546-4d7b-83ae-34e1e26f97d4	0e34705e-59f0-4c48-b0e2-e70184163be1	24433.97	2026-05-07 07:49:05.019353+00	2026-06-04 03:58:51.499181+00
5a121525-da14-4a4c-9538-366fd178d6bd	fe9220e1-1e1d-43b3-864f-e65cec183c90	10.05	2026-05-04 12:18:52.850463+00	2026-06-07 04:15:25.938382+00
3c40cc87-c78c-4015-b2db-15c356e30d96	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	17103.25	2026-05-07 07:42:21.299428+00	2026-06-10 07:45:29.207602+00
5fdd8d54-9b17-41ee-ae40-8d678973c140	a5ed9b09-88c3-453f-8db1-75e8773a7344	50	2026-07-06 12:59:54.107755+00	2026-07-10 13:22:56.635742+00
b8d9e477-b396-455d-9c32-6d6e79f7bba7	1d1be295-3305-4397-b9fb-dac021af69b0	15009.06	2026-05-15 01:21:33.303942+00	2026-07-10 13:23:01.881351+00
f7d777f3-4a16-456a-8d48-0a845916e7c0	2c9fb196-b062-42f1-9894-e7178ea038f6	985.72	2026-06-24 07:33:15.84394+00	2026-07-10 13:43:32.70409+00
e37e775e-33b7-4839-bf73-97af57e3c516	e57f811f-ddfd-406f-8050-bedf7bdacd10	1398.02	2026-07-08 13:51:25.025217+00	2026-07-10 13:45:19.860297+00
0274dc43-9700-4b22-b08a-6e6723e17f78	e27a490d-fbfa-407b-9a85-fa628f5a8495	0	2026-07-10 13:50:51.446483+00	2026-07-10 13:50:51.446483+00
\.


--
-- Data for Name: withdrawal_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.withdrawal_requests (id, user_id, amount, status, bank_name, account_number, account_holder_name, admin_notes, processed_at, created_at) FROM stdin;
c81c669c-30cd-4a92-b6b9-bb502a29c3a3	0e34705e-59f0-4c48-b0e2-e70184163be1	0.01	APPROVED	FarhanBank	1234567890123456	Farhan	\N	2026-05-10 03:15:30.148869+00	2026-05-10 03:15:16.272155+00
c6ccb311-7d3e-449f-83c1-366809a140c3	0e34705e-59f0-4c48-b0e2-e70184163be1	10	APPROVED	FarhanBank	1234567890123456	Farhan	Hi	2026-05-10 04:07:47.587086+00	2026-05-10 04:07:14.175367+00
e2f26358-28a6-4db9-b29b-be6e9fa3ec68	0e34705e-59f0-4c48-b0e2-e70184163be1	1700	REJECTED	FarhanBank	1234567890123456	Farhan	\N	2026-05-15 02:25:18.198358+00	2026-05-15 02:24:18.477536+00
8fdd7033-81c3-463b-afbf-39f2162bed6b	0e34705e-59f0-4c48-b0e2-e70184163be1	1700	APPROVED	FarhanBank	1234567890123456	Farhan	Sup Bro!!!	2026-05-15 02:26:24.026894+00	2026-05-15 02:25:33.756328+00
92b594ef-9ed4-4813-9afc-ae1348448a29	f8aa13be-d7b5-4b10-8dc9-6a4e4f204799	10	APPROVED	Bank	1000	1000	\N	2026-05-15 03:02:01.954371+00	2026-05-15 03:01:09.477963+00
f515d251-fb4d-490c-bec9-f006c966e5ed	1d1be295-3305-4397-b9fb-dac021af69b0	12	APPROVED	qejobnjld	1234567890110101010	Emio	\N	2026-05-15 08:34:42.9314+00	2026-05-15 08:34:09.413027+00
7adf09de-85b6-442f-8199-d3396bbd745b	1d1be295-3305-4397-b9fb-dac021af69b0	16	APPROVED	qejobnjld	1234567890110101010	Emio	Withdrawal Success 	2026-05-18 02:17:10.548349+00	2026-05-18 02:16:39.674032+00
64095856-7891-4be7-8d91-be8774573502	1d1be295-3305-4397-b9fb-dac021af69b0	15.09	APPROVED	qejobnjld	1234567890110101010	Emio	Approved	2026-05-18 06:50:12.042713+00	2026-05-18 06:49:22.428511+00
831c8d73-330b-4ad5-8ca8-27d58441bca4	0e34705e-59f0-4c48-b0e2-e70184163be1	1000	APPROVED	FarhanBank	1234567890123456	Farhan	Rejected 	2026-05-18 06:51:54.134444+00	2026-05-18 06:51:34.893164+00
ca5d09c9-fec1-49f9-8ecf-d2581d69ec1f	0e34705e-59f0-4c48-b0e2-e70184163be1	100	REJECTED	FarhanBank	1234567890123456	Farhan	\N	2026-05-18 06:57:31.412324+00	2026-05-18 06:57:13.521207+00
acdcc1df-2a24-4e60-a4e2-2df5bef37ebb	0e34705e-59f0-4c48-b0e2-e70184163be1	100	REJECTED	FarhanBank	1234567890123456	Farhan	\N	2026-05-18 06:58:37.83895+00	2026-05-18 06:58:15.638432+00
c223cf6d-cb48-4719-9502-b350e481df12	1d1be295-3305-4397-b9fb-dac021af69b0	20	APPROVED	qejobnjld	1234567890110101010	Emio	\N	2026-05-18 07:52:15.35206+00	2026-05-18 07:52:00.382529+00
0aaa3edf-3d55-40a5-a96b-4724eacef0cd	1d1be295-3305-4397-b9fb-dac021af69b0	50	REJECTED	qejobnjld	1234567890110101010	Emio	\N	2026-06-04 06:16:48.899907+00	2026-06-04 06:16:39.943059+00
df4daf4c-09ab-4de1-af2b-684278769002	7e438196-958b-4cb5-831c-0027b8a009cb	10	APPROVED	CIMB Bank	12345678912345	Emi	\N	2026-06-24 07:06:12.36296+00	2026-06-24 07:05:58.127977+00
6ece5806-bb3c-4ee8-90a4-363d8f7d8d89	7e438196-958b-4cb5-831c-0027b8a009cb	10	APPROVED	CIMB Bank	12345678912345	Emi	\N	2026-06-24 07:06:32.030921+00	2026-06-24 07:06:23.927023+00
cfa01078-fe7d-4e0b-88d4-bc2c1152ca7e	7e438196-958b-4cb5-831c-0027b8a009cb	20	REJECTED	CIMB Bank	12345678912345	Emi	\N	2026-06-24 07:11:34.101078+00	2026-06-24 07:11:28.242971+00
83c24815-9381-408e-afec-be2528cf3e67	2c9fb196-b062-42f1-9894-e7178ea038f6	1000	APPROVED	Maybank	123456789012	hy	\N	2026-06-24 07:42:54.172493+00	2026-06-24 07:42:42.976514+00
f1116de2-e8d0-4e44-932d-33171704134a	1d1be295-3305-4397-b9fb-dac021af69b0	1000	APPROVED	qejobnjld	1234567890110101010	Emio	\N	2026-06-24 08:11:04.489988+00	2026-06-24 08:10:43.801879+00
0ec48587-a02d-4cb5-b972-dfb4aa7d63ed	fe9220e1-1e1d-43b3-864f-e65cec183c90	10	APPROVED	Maybank	107022406756	Tan Eng Hoo	\N	2026-06-25 04:15:32.152377+00	2026-05-19 13:45:47.999007+00
aaa89d5e-0e43-4845-94b9-5a5b34347064	067c11cc-f14f-439a-a673-c48b7b210aa1	10	REJECTED	Maybank	123456789012	henria	fake	2026-06-25 04:42:37.977716+00	2026-06-25 04:42:20.759836+00
30c1c0d1-c7ba-41d2-afbd-99c0dc90575f	1d1be295-3305-4397-b9fb-dac021af69b0	100	APPROVED	qejobnjld	1234567890110101010	Emio	\N	2026-06-25 07:56:04.325093+00	2026-06-25 07:55:50.684586+00
75d42f6c-1e99-4892-997d-37d122dabaf1	1d1be295-3305-4397-b9fb-dac021af69b0	119	APPROVED	Hong Leong Bank	123412341234	Emio	\N	2026-06-25 07:57:59.517706+00	2026-06-25 07:57:49.791311+00
70b91003-1eba-4dde-9f15-5fb8ea53fd4b	1d1be295-3305-4397-b9fb-dac021af69b0	119	APPROVED	Hong Leong Bank	123412341234	Emio	\N	2026-06-25 08:00:11.400912+00	2026-06-25 07:58:55.568918+00
e68595b5-c010-42bf-b886-0b5a250bd701	1d1be295-3305-4397-b9fb-dac021af69b0	100	REJECTED	Hong Leong Bank	123412341234	Emio	NEED to contsact admin	2026-06-26 06:39:09.121867+00	2026-06-26 06:38:40.668967+00
05aa72d1-470c-48ab-a10c-2918c59b6410	1d1be295-3305-4397-b9fb-dac021af69b0	10	APPROVED	Hong Leong Bank	123412341234	Emio	\N	2026-06-26 06:39:41.510338+00	2026-06-26 06:39:29.262868+00
8681fdde-657c-4329-a04e-d20c170498f6	2c9fb196-b062-42f1-9894-e7178ea038f6	38000	APPROVED	Maybank	123456789012	hy	\N	2026-06-26 07:31:37.434797+00	2026-06-26 07:31:13.19476+00
eaf9b2c4-c069-4999-ab2a-d6a76b5c1978	a5ed9b09-88c3-453f-8db1-75e8773a7344	50	APPROVED	CIMB Bank	12341234123412	CMB	\N	2026-07-06 13:07:43.203061+00	2026-07-06 13:07:34.462638+00
247cb2ed-bf95-4bd8-a459-b9c9b1060cd8	2c9fb196-b062-42f1-9894-e7178ea038f6	10	APPROVED	Maybank	123456789012	hy	\N	2026-07-10 01:19:53.311815+00	2026-07-10 01:19:44.58583+00
9d35ad2b-955a-46d8-aea9-bf11a7974a73	2c9fb196-b062-42f1-9894-e7178ea038f6	11	REJECTED	Maybank	123456789012	hy	\N	2026-07-10 07:48:45.653958+00	2026-07-10 07:48:21.675124+00
ea735e86-f47a-4b75-8cff-56c5a28e7143	e57f811f-ddfd-406f-8050-bedf7bdacd10	1000	APPROVED	Public Bank	1111111111	jt	\N	2026-07-10 13:39:56.918918+00	2026-07-10 13:39:44.83494+00
a3b2cc24-e879-47c2-905f-26f347f08137	2c9fb196-b062-42f1-9894-e7178ea038f6	10	APPROVED	Maybank	123456789012	hy	\N	2026-07-10 13:43:40.802516+00	2026-07-10 13:43:32.70409+00
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: task_sessions task_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: ix_bank_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_bank_accounts_user_id ON public.bank_accounts USING btree (user_id);


--
-- Name: ix_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_wallets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_wallets_user_id ON public.wallets USING btree (user_id);


--
-- Name: ix_withdrawal_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_withdrawal_requests_user_id ON public.withdrawal_requests USING btree (user_id);


--
-- Name: applications applications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: applications applications_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);


--
-- Name: bank_accounts bank_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: messages messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: projects projects_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: task_sessions task_sessions_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: task_sessions task_sessions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: task_sessions task_sessions_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CFfKFc8J8pc0l6FIF5ObapcUGZ8ZKRtl6ZYped22iTddzAzz8D7EXKzNEZy6Pxr

