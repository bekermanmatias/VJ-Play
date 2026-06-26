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
    '65fa984a-38ee-4792-9213-d3c845825985',
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
    'ed03b05b-40fb-4475-9f6f-8e2a8576b7ab',
    '65fa984a-38ee-4792-9213-d3c845825985',
    'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_futbol_5 IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('65fa984a-38ee-4792-9213-d3c845825985', cat_futbol_5);
  END IF;

  -- NOTICIA: Inauguración de las nuevas canchas de Pádel
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '3afa58d9-4109-4c8b-8e2e-eec9b2210ab3',
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
    'c00398ea-f5a0-4c3e-a9d0-5a2f6ddaae73',
    '3afa58d9-4109-4c8b-8e2e-eec9b2210ab3',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_padel IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('3afa58d9-4109-4c8b-8e2e-eec9b2210ab3', cat_padel);
  END IF;

  -- NOTICIA: Arrancan las clases de Aquagym y Natación
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    'd4deaebf-4832-4aac-89d7-1b86863dc050',
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
    '646eece3-a2bc-44c8-8853-2b3b1379315f',
    'd4deaebf-4832-4aac-89d7-1b86863dc050',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_natacion IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('d4deaebf-4832-4aac-89d7-1b86863dc050', cat_natacion);
  END IF;

  -- NOTICIA: Clínica intensiva de Básquet para juveniles
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '3965fd7e-f0cd-4557-a2f3-0d6ffddcd722',
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
    'b6fc1845-b561-46a6-b2ee-ec20075684ba',
    '3965fd7e-f0cd-4557-a2f3-0d6ffddcd722',
    'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_basquet IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('3965fd7e-f0cd-4557-a2f3-0d6ffddcd722', cat_basquet);
  END IF;

  -- NOTICIA: El equipo de Hockey Femenino clasifica a la final
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '5ae0d982-1c3e-4b4a-a3c6-68eefcaaf917',
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
    'e626bed0-17c1-40a9-9d89-42573d52fd3e',
    '5ae0d982-1c3e-4b4a-a3c6-68eefcaaf917',
    'https://images.unsplash.com/photo-1515787366009-7cbdd2dc5874?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_hockey IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('5ae0d982-1c3e-4b4a-a3c6-68eefcaaf917', cat_hockey);
  END IF;

  -- NOTICIA: Nueva sala de Musculación y Fitness
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '15302701-a0c0-42dc-ad75-47a90f9fd851',
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
    '89439df6-00f1-4f81-94fa-bfbe0c48e5d7',
    '15302701-a0c0-42dc-ad75-47a90f9fd851',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Clases de Yoga al aire libre
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '59135d51-b331-43bb-b597-ba8f2def15f8',
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
    'a62c960e-1de5-4f28-ad6a-040d134d2e03',
    '59135d51-b331-43bb-b597-ba8f2def15f8',
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Resultados del Torneo de Atletismo
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '13b27ee0-6f0c-43d6-a4de-9d062094cb23',
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
    '69102e69-6ad8-4113-97ef-115488a4e496',
    '13b27ee0-6f0c-43d6-a4de-9d062094cb23',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_atletismo IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('13b27ee0-6f0c-43d6-a4de-9d062094cb23', cat_atletismo);
  END IF;

  -- NOTICIA: Inscripciones abiertas para la Liga de Vóley
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '65d33d15-9093-400e-ab70-a2d7fc602c9c',
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
    '9082ff62-5c42-4836-bea9-5f8681b0dc66',
    '65d33d15-9093-400e-ab70-a2d7fc602c9c',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_voley IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('65d33d15-9093-400e-ab70-a2d7fc602c9c', cat_voley);
  END IF;

  -- NOTICIA: Remodelación de la Cafetería
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '85a185f7-e649-4d3a-92be-bf2e2f2c1df6',
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
    '3eb1fea9-c53c-4c88-bf98-484b8a8e8d32',
    '85a185f7-e649-4d3a-92be-bf2e2f2c1df6',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Colonia de Verano: ¡Ya podés reservar tu lugar!
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '54e6093d-00ee-4f94-ae89-9de9fdfbc89f',
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
    '7f8311dd-0ea3-432b-96c1-d09a236fab5c',
    '54e6093d-00ee-4f94-ae89-9de9fdfbc89f',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  -- NOTICIA: Torneo Interno de Tenis Dobles
  INSERT INTO public.news (id, slug, title, summary, body, published, published_at, created_at, updated_at)
  VALUES (
    '78f6faa5-af24-446e-b703-b3f89f0626d8',
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
    '337bdb86-d471-4d91-b1ed-4b85fa5ad6bc',
    '78f6faa5-af24-446e-b703-b3f89f0626d8',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1f4?auto=format&fit=crop&w=1600&q=80',
    true,
    0
  );

  IF cat_tenis IS NOT NULL THEN
    INSERT INTO public.news_category_links (news_id, category_id) VALUES ('78f6faa5-af24-446e-b703-b3f89f0626d8', cat_tenis);
  END IF;

END $$;
