CREATE TABLE public.daily_data (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_user bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  check_status boolean DEFAULT false,
  option text,
  CONSTRAINT daily_data_pkey PRIMARY KEY (id),
  CONSTRAINT daily_data_id_user_fkey FOREIGN KEY (id_user) REFERENCES public.daily_user(id)
);
CREATE TABLE public.daily_user (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text UNIQUE,
  title text,
  option text,
  time_to_send integer,
  name text,
  CONSTRAINT daily_user_pkey PRIMARY KEY (id)
);