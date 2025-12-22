CREATE TABLE public.daily_data (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_user bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  check_status boolean DEFAULT false,
  CONSTRAINT daily_data_pkey PRIMARY KEY (id),
  CONSTRAINT daily_data_id_user_fkey FOREIGN KEY (id_user) REFERENCES public.daily_user(id) ON DELETE CASCADE
);
CREATE TABLE public.daily_user (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text,
  title text,
  option jsonb,
  time_to_send integer,
  CONSTRAINT daily_user_pkey PRIMARY KEY (id)
);