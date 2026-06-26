-- Script para llenar noticias de prueba con imágenes.
-- Copiá y pegá esto en el "SQL Editor" de tu proyecto de Staging (y el de Producción si querés) en Supabase y dale a "Run".

DO $$
DECLARE
  news1_id uuid := '11111111-1111-1111-1111-111111111111';
  news2_id uuid := '22222222-2222-2222-2222-222222222222';
  news3_id uuid := '33333333-3333-3333-3333-333333333333';
  cat_futbol uuid;
  cat_padel uuid;
  cat_natacion uuid;
BEGIN
  -- 1. Obtener IDs de las categorías (asumiendo que ya se crearon con las migrations)
  SELECT id INTO cat_futbol FROM public.news_categories WHERE slug = 'futbol-5' LIMIT 1;
  SELECT id INTO cat_padel FROM public.news_categories WHERE slug = 'padel' LIMIT 1;
  SELECT id INTO cat_natacion FROM public.news_categories WHERE slug = 'natacion' LIMIT 1;

  -- 2. Insertar las Noticias
  INSERT INTO public.news (id, slug, title, summary, body, author, published, published_at)
  VALUES 
  (
    news1_id, 
    'nuevo-torneo-futbol-5', 
    '¡Arranca el Torneo Relámpago de Fútbol 5!', 
    'Este fin de semana te esperamos para vivir el torneo de Fútbol 5 más emocionante de la zona sur.', 
    '<p>Preparen los botines porque este sábado arranca nuestro clásico torneo de Fútbol 5. Habrá premios para los primeros tres puestos, servicio de buffet y transmisión de los mejores partidos en VJ Play.</p><p>¡Inscribí a tu equipo en la secretaría del club antes del viernes!</p>', 
    'Secretaría de Deportes', 
    true, 
    now()
  ),
  (
    news2_id, 
    'nuevas-canchas-padel-vidrio', 
    'Inauguración de las canchas de Pádel de Blindex', 
    'Seguimos invirtiendo en infraestructura: ya están listas las nuevas canchas profesionales.', 
    '<p>Tenemos el orgullo de anunciar que finalizaron las obras en el sector de raquetas. Nuestras nuevas canchas de pádel con paredes de blindex y césped sintético profesional ya están habilitadas para todos los socios.</p><p>¡Reservá tu turno desde la app y vení a estrenarlas!</p>', 
    'Comisión Directiva', 
    true, 
    now() - interval '2 days'
  ),
  (
    news3_id, 
    'temporada-pileta-climatizada', 
    'Arrancan las clases de Aquagym y Natación', 
    'La pileta cubierta ya está a temperatura ideal para arrancar la temporada de invierno.', 
    '<p>No hay excusas para dejar de entrenar en invierno. Nuestra pileta climatizada ya está funcionando a pleno con clases de Natación para todas las edades, matronatación y los ya clásicos turnos de Aquagym.</p><p>Acercate a informes para conocer la grilla de horarios completa.</p>', 
    'Coordinación Pileta', 
    true, 
    now() - interval '5 days'
  )
  ON CONFLICT (slug) DO NOTHING;

  -- 3. Insertar las imágenes principales (sacadas de Unsplash para que queden lindas)
  INSERT INTO public.news_images (news_id, image_url, is_main, alt_text)
  VALUES 
  (news1_id, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop', true, 'Pelota de fútbol en la cancha'),
  (news2_id, 'https://images.unsplash.com/photo-1622279457486-62dcc4a631d6?q=80&w=1000&auto=format&fit=crop', true, 'Cancha de pádel profesional'),
  (news3_id, 'https://images.unsplash.com/photo-1519315901367-f34f9274ceb0?q=80&w=1000&auto=format&fit=crop', true, 'Pileta de natación')
  ON CONFLICT (news_id) WHERE is_main DO NOTHING;

  -- 4. Vincular noticias con sus categorías
  INSERT INTO public.news_category_links (news_id, category_id)
  VALUES 
  (news1_id, cat_futbol),
  (news2_id, cat_padel),
  (news3_id, cat_natacion)
  ON CONFLICT (news_id, category_id) DO NOTHING;

END $$;
