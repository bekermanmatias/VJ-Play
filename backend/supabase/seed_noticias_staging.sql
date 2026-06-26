-- Script para limpiar y volver a llenar noticias de prueba con imágenes.

DO $$
DECLARE
  cat_futbol_5 uuid;
  cat_padel uuid;
  cat_natacion uuid;
  cat_basquet uuid;
  cat_hockey uuid;
  cat_atletismo uuid;
  cat_voley uuid;
  cat_tenis uuid;
BEGIN
  -- 1. Limpiar noticias anteriores (por cascade se borran imágenes y links)
  DELETE FROM public.news;

  -- 2. Buscar IDs de categorías existentes
  SELECT id INTO cat_futbol_5 FROM public.news_categories WHERE slug = 'futbol-5' LIMIT 1;
  SELECT id INTO cat_padel FROM public.news_categories WHERE slug = 'padel' LIMIT 1;
  SELECT id INTO cat_natacion FROM public.news_categories WHERE slug = 'natacion' LIMIT 1;
  SELECT id INTO cat_basquet FROM public.news_categories WHERE slug = 'basquet' LIMIT 1;
  SELECT id INTO cat_hockey FROM public.news_categories WHERE slug = 'hockey' LIMIT 1;
  SELECT id INTO cat_atletismo FROM public.news_categories WHERE slug = 'atletismo' LIMIT 1;
  SELECT id INTO cat_voley FROM public.news_categories WHERE slug = 'voley' LIMIT 1;
  SELECT id INTO cat_tenis FROM public.news_categories WHERE slug = 'tenis' LIMIT 1;

  -- 3. Insertar Noticias e Imágenes

  -- NOTICIA: ¡Arranca el Torneo Relámpago de Fútbol 5!
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'cb64fec0-f605-4755-b96b-cdede58f88aa',
    'torneo-relampago-futbol-5',
    '¡Arranca el Torneo Relámpago de Fútbol 5!',
    'Este fin de semana te esperamos para vivir el torneo de Fútbol 5 más emocionante de la zona sur.',
    '<p>Vení con tu equipo y demostrá quién manda en la cancha. El torneo relámpago de Fútbol 5 se jugará este sábado desde las 10:00 AM.</p><p>Habrá premios para los tres primeros puestos y buffet abierto todo el día. ¡No te quedes afuera!</p>',
    true,
    now() - interval '0 days',
    now() - interval '0 days',
    now() - interval '0 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'e2d6c4a9-de9a-4b03-b700-812958a5cfb6',
    'cb64fec0-f605-4755-b96b-cdede58f88aa',
    'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_futbol_5 IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('cb64fec0-f605-4755-b96b-cdede58f88aa', cat_futbol_5);
  END IF;

  -- NOTICIA: Inauguración de las nuevas canchas de Pádel
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '504301e3-ecea-4131-bd5f-ef8068f7118f',
    'inauguracion-canchas-padel',
    'Inauguración de las nuevas canchas de Pádel',
    'Seguimos invirtiendo en infraestructura: ya están listas las nuevas canchas profesionales de blindex.',
    '<p>Con mucho orgullo anunciamos que ya están habilitadas las dos nuevas canchas de Pádel profesionales. Las mismas cuentan con césped sintético de última generación e iluminación LED.</p><p>Podés reservar tu turno desde hoy mismo en la secretaría del club.</p>',
    true,
    now() - interval '1 days',
    now() - interval '1 days',
    now() - interval '1 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '22adf38a-4d4f-4534-a827-c6db920d94fe',
    '504301e3-ecea-4131-bd5f-ef8068f7118f',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_padel IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('504301e3-ecea-4131-bd5f-ef8068f7118f', cat_padel);
  END IF;

  -- NOTICIA: Arrancan las clases de Aquagym y Natación
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '21345d70-99d5-4d90-b962-5178be896d11',
    'clases-aquagym-natacion',
    'Arrancan las clases de Aquagym y Natación',
    'La pileta cubierta ya está a temperatura ideal para arrancar la temporada de invierno.',
    '<p>Este lunes comienzan oficialmente las clases de natación para todas las edades y niveles. Además, sumamos nuevos horarios de Aquagym por la mañana y la tarde.</p><p>Consultá la grilla de horarios en recepción. Cupos limitados.</p>',
    true,
    now() - interval '2 days',
    now() - interval '2 days',
    now() - interval '2 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'ca6e62a7-7261-4d5a-8ab6-7d1cf37c4efe',
    '21345d70-99d5-4d90-b962-5178be896d11',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_natacion IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('21345d70-99d5-4d90-b962-5178be896d11', cat_natacion);
  END IF;

  -- NOTICIA: Clínica intensiva de Básquet para juveniles
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'fd549bd7-d903-4bff-b827-67a0f5cb2e72',
    'clinica-basquet-juveniles',
    'Clínica intensiva de Básquet para juveniles',
    'Invitamos a todos los chicos y chicas de entre 12 y 17 años a participar de nuestra clínica de básquet.',
    '<p>El próximo domingo contaremos con la presencia de entrenadores de primer nivel que dictarán una clínica intensiva de fundamentos tácticos y técnicos.</p><p>La actividad es gratuita para socios. Requiere inscripción previa.</p>',
    true,
    now() - interval '3 days',
    now() - interval '3 days',
    now() - interval '3 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '981e15e0-8dcd-4f34-a0be-cf2d4581e54d',
    'fd549bd7-d903-4bff-b827-67a0f5cb2e72',
    'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_basquet IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('fd549bd7-d903-4bff-b827-67a0f5cb2e72', cat_basquet);
  END IF;

  -- NOTICIA: El equipo de Hockey Femenino clasifica a la final
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'fc9ea62a-bf4d-4044-a46c-8eba486cda28',
    'hockey-femenino-final',
    'El equipo de Hockey Femenino clasifica a la final',
    'Nuestras chicas de la primera división lograron un triunfo histórico el pasado fin de semana.',
    '<p>En un partido vibrante, el equipo mayor femenino de hockey venció por 2 a 1 en las semifinales y se aseguró un lugar en la gran final del torneo regional.</p><p>Felicitamos a las jugadoras y al cuerpo técnico por el enorme esfuerzo.</p>',
    true,
    now() - interval '4 days',
    now() - interval '4 days',
    now() - interval '4 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '386eed11-80cc-46f4-9007-e60ae670687d',
    'fc9ea62a-bf4d-4044-a46c-8eba486cda28',
    'https://images.unsplash.com/photo-1515787366009-7cbdd2dc5874?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_hockey IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('fc9ea62a-bf4d-4044-a46c-8eba486cda28', cat_hockey);
  END IF;

  -- NOTICIA: Nueva sala de Musculación y Fitness
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '658f45cc-2c04-4496-95f0-e4de8063597e',
    'nueva-sala-musculacion',
    'Nueva sala de Musculación y Fitness',
    'Renovamos completamente las máquinas y pesas del gimnasio para brindarte un mejor servicio.',
    '<p>Ya podés venir a probar las nuevas cintas, elípticos y máquinas de fuerza que instalamos en el gimnasio del club. Además, ampliamos el sector de peso libre.</p><p>Recordá traer toalla y botella de agua personal.</p>',
    true,
    now() - interval '5 days',
    now() - interval '5 days',
    now() - interval '5 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'f706d51f-6ace-4b61-a465-bfd687f153d3',
    '658f45cc-2c04-4496-95f0-e4de8063597e',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Clases de Yoga al aire libre
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'e88a36b7-e197-4b8f-9740-8ae484083c21',
    'yoga-aire-libre',
    'Clases de Yoga al aire libre',
    'Aprovechamos los días lindos de primavera para relajar cuerpo y mente en los jardines del club.',
    '<p>Todos los martes y jueves a las 18:00 hs mudamos las clases de Yoga a los espacios verdes del club. Traé tu mat y conectate con la naturaleza.</p><p>Actividad apta para todos los niveles, no requiere experiencia previa.</p>',
    true,
    now() - interval '6 days',
    now() - interval '6 days',
    now() - interval '6 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'ba89a817-7a48-4f47-bb3b-9730b5463fe9',
    'e88a36b7-e197-4b8f-9740-8ae484083c21',
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Resultados del Torneo de Atletismo
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'd6a7c147-b3d6-4ae9-838d-9e414844739c',
    'resultados-atletismo',
    'Resultados del Torneo de Atletismo',
    'Nuestros representantes brillaron en el encuentro interclubes de atletismo este mes.',
    '<p>Con gran orgullo compartimos los excelentes resultados obtenidos por nuestra escuela de atletismo. Logramos sumar medallas en las disciplinas de velocidad, salto en largo y lanzamiento de jabalina.</p>',
    true,
    now() - interval '7 days',
    now() - interval '7 days',
    now() - interval '7 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '5ae09229-02df-4272-9f98-43710422d521',
    'd6a7c147-b3d6-4ae9-838d-9e414844739c',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_atletismo IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('d6a7c147-b3d6-4ae9-838d-9e414844739c', cat_atletismo);
  END IF;

  -- NOTICIA: Inscripciones abiertas para la Liga de Vóley
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '84b4e530-8d1f-453b-abae-149cd62ab7f6',
    'inscripciones-voley',
    'Inscripciones abiertas para la Liga de Vóley',
    'Armá tu equipo y participá del torneo mixto de Vóley que organiza el club.',
    '<p>Están abiertas las inscripciones para el torneo anual de Vóley mixto. Podés anotar a tu equipo en la secretaría hasta el viernes 15.</p><p>Los partidos se jugarán los sábados por la tarde en el gimnasio principal.</p>',
    true,
    now() - interval '8 days',
    now() - interval '8 days',
    now() - interval '8 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'e406523a-a50b-4718-a5cf-905cf808bde1',
    '84b4e530-8d1f-453b-abae-149cd62ab7f6',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_voley IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('84b4e530-8d1f-453b-abae-149cd62ab7f6', cat_voley);
  END IF;

  -- NOTICIA: Remodelación de la Cafetería
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '4d8d26b0-27af-41dc-94af-2d917166cb24',
    'remodelacion-cafeteria',
    'Remodelación de la Cafetería',
    'Terminamos las obras en el sector gastronómico para ofrecer un espacio moderno y acogedor.',
    '<p>Te invitamos a conocer el nuevo buffet / cafetería del club, que ahora cuenta con sector de sillones, WiFi de alta velocidad y un menú renovado con opciones saludables.</p><p>Ideal para el tercer tiempo o para esperar a los chicos mientras entrenan.</p>',
    true,
    now() - interval '9 days',
    now() - interval '9 days',
    now() - interval '9 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    'c22a409d-22ed-441d-b762-2949c42ddac7',
    '4d8d26b0-27af-41dc-94af-2d917166cb24',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Colonia de Verano: ¡Ya podés reservar tu lugar!
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '6496d20b-e273-47b0-a9cd-198ad0f8435d',
    'colonia-verano',
    'Colonia de Verano: ¡Ya podés reservar tu lugar!',
    'Asegurá la vacante para la mejor temporada de verano de la ciudad.',
    '<p>Se abrió la inscripción temprana para la Colonia de Verano Varela Junior. Actividades recreativas, natación, juegos al aire libre y mucho más para chicos de 4 a 12 años.</p><p>Hay descuentos exclusivos pagando en efectivo antes del 30 de noviembre.</p>',
    true,
    now() - interval '10 days',
    now() - interval '10 days',
    now() - interval '10 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '5652ce15-16bf-4dc2-ba67-00cb8cb8616a',
    '6496d20b-e273-47b0-a9cd-198ad0f8435d',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Torneo Interno de Tenis Dobles
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '37568840-d891-4f63-91a4-b27fb17f8142',
    'torneo-interno-tenis-dobles',
    'Torneo Interno de Tenis Dobles',
    'Llega el torneo más divertido del año. Formá pareja y competí en nuestro clásico torneo interno.',
    '<p>El próximo fin de semana se disputará el torneo de Tenis Dobles para las categorías A, B y C. Habrá choripaneada de cierre y entrega de trofeos.</p><p>Anotate con tu pareja en secretaría o buscando el formulario online en nuestras redes.</p>',
    true,
    now() - interval '11 days',
    now() - interval '11 days',
    now() - interval '11 days'
  );

  INSERT INTO public.news_images (id, news_id, image_url, is_main, sort_order)
  VALUES (
    '1517e0a0-3dc9-4a02-ae7f-615d37800932',
    '37568840-d891-4f63-91a4-b27fb17f8142',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_tenis IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('37568840-d891-4f63-91a4-b27fb17f8142', cat_tenis);
  END IF;

END $$;
