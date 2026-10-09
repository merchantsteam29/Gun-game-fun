import { opts, onOpts } from './settings.js';

// Languages. The game is written in English; this swaps the interface text for the chosen
// language as it appears on screen (menus, settings, HUD), by exact match plus a few patterns
// for text with numbers in it. Player names, chat, gamertags, weapon / map / cosmetic names
// stay as they are. Anything not in the table simply stays in English.

export const LANGS = [
  { id: 'auto', name: 'Auto' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
  { id: 'fr', name: 'Français' },
];
const IDS = ['es', 'pt', 'fr'];

// [English, Spanish, Portuguese, French]
const ROWS = [
  // ---- Menu shell ----
  ['Play', 'Jugar', 'Jogar', 'Jouer'],
  ['Join or create a match', 'Únete o crea una partida', 'Entre ou crie uma partida', 'Rejoindre ou créer une partie'],
  ['Loadout', 'Equipamiento', 'Equipamento', 'Équipement'],
  ['Pick your weapons', 'Elige tus armas', 'Escolha suas armas', 'Choisis tes armes'],
  ['Character', 'Personaje', 'Personagem', 'Personnage'],
  ['Name, color, cosmetics', 'Nombre, color, cosméticos', 'Nome, cor, cosméticos', 'Nom, couleur, cosmétiques'],
  ['Missions', 'Misiones', 'Missões', 'Missions'],
  ['Season pass & daily rewards', 'Pase de temporada y premios diarios', 'Passe de temporada e prêmios diários', 'Passe de saison et récompenses quotidiennes'],
  ['Leaderboard', 'Clasificación', 'Classificação', 'Classement'],
  ['Weekly, all-time, per mode', 'Semanal, histórica, por modo', 'Semanal, geral, por modo', 'Hebdo, tous les temps, par mode'],
  ['Friends', 'Amigos', 'Amigos', 'Amis'],
  ['Gamertags & party chat', 'Gamertags y chat de grupo', 'Gamertags e chat do grupo', 'Gamertags et chat de groupe'],
  ['Practice', 'Práctica', 'Treino', 'Entraînement'],
  ['Solo range · every weapon', 'Campo de tiro · todas las armas', 'Estande solo · todas as armas', 'Stand de tir · toutes les armes'],
  ['Settings', 'Ajustes', 'Configurações', 'Paramètres'],
  ['Controls, video, audio', 'Controles, video, audio', 'Controles, vídeo, áudio', 'Commandes, vidéo, audio'],
  ['Keyboard & mouse', 'Teclado y ratón', 'Teclado e mouse', 'Clavier et souris'],
  ['Rotate your phone to landscape', 'Gira tu teléfono en horizontal', 'Gire o celular para a horizontal', 'Tourne ton téléphone en paysage'],
  ['Change keys in Settings → Controls', 'Cambia las teclas en Ajustes → Controles', 'Mude as teclas em Configurações → Controles', 'Change les touches dans Paramètres → Commandes'],
  ['🎓 Play the tutorial', '🎓 Jugar el tutorial', '🎓 Jogar o tutorial', '🎓 Lancer le tutoriel'],
  ['move', 'moverse', 'mover', 'se déplacer'], ['aim', 'apuntar', 'mirar', 'viser'], ['fire', 'disparar', 'atirar', 'tirer'],
  ['aim down sights', 'apuntar con la mira', 'mirar pela mira', 'viser avec le viseur'], ['jump', 'saltar', 'pular', 'sauter'],
  ['sprint', 'correr', 'correr', 'sprinter'], ['crouch · slide', 'agacharse · deslizarse', 'agachar · deslizar', "s'accroupir · glisser"],
  ['reload', 'recargar', 'recarregar', 'recharger'], ['last weapon', 'última arma', 'última arma', 'dernière arme'],
  ['quick throw', 'lanzamiento rápido', 'arremesso rápido', 'lancer rapide'], ['quick melee', 'cuerpo a cuerpo rápido', 'corpo a corpo rápido', 'mêlée rapide'],
  ['inspect', 'inspeccionar', 'inspecionar', 'inspecter'], ['scoreboard', 'marcador', 'placar', 'tableau des scores'],
  ['pause', 'pausa', 'pausar', 'pause'], ['chat', 'chat', 'chat', 'chat'],

  // ---- Play / home ----
  ['Quick Play, ranked, the featured mode of the day, or pick a server.', 'Partida rápida, clasificatoria, el modo destacado del día o elige un servidor.', 'Partida rápida, ranqueada, o modo em destaque do dia ou escolha um servidor.', 'Partie rapide, classée, le mode du jour, ou choisis un serveur.'],
  ['Quick Play', 'Partida rápida', 'Partida rápida', 'Partie rapide'],
  ['Jump into a match', 'Entra en una partida', 'Entre em uma partida', 'Lance-toi dans une partie'],
  ['Play now ▶', 'Jugar ya ▶', 'Jogar agora ▶', 'Jouer ▶'],
  ['Starts a match with bots if nobody is on', 'Empieza una partida con bots si no hay nadie', 'Começa uma partida com bots se ninguém estiver on', "Lance une partie avec des bots s'il n'y a personne"],
  ['Ranked', 'Clasificatoria', 'Ranqueada', 'Classée'],
  ['Game Night', 'Noche de juego', 'Noite de jogo', 'Soirée de jeu'],
  ['Claim', 'Reclamar', 'Resgatar', 'Récupérer'],
  ['Join', 'Unirse', 'Entrar', 'Rejoindre'],
  ['Servers', 'Servidores', 'Servidores', 'Serveurs'],
  ['● Live', '● En vivo', '● Ao vivo', '● En direct'],
  ['All regions', 'Todas las regiones', 'Todas as regiões', 'Toutes les régions'],
  ['+ Create server', '+ Crear servidor', '+ Criar servidor', '+ Créer un serveur'],
  ['New here? Take the 1-minute tutorial', '¿Eres nuevo? Haz el tutorial de 1 minuto', 'Novo aqui? Faça o tutorial de 1 minuto', 'Nouveau ? Fais le tutoriel d’1 minute'],
  ['No public servers right now. Create one and your friends (or anyone) can join!', 'No hay servidores públicos ahora. ¡Crea uno y tus amigos (o cualquiera) podrán unirse!', 'Nenhum servidor público agora. Crie um e seus amigos (ou qualquer um) podem entrar!', 'Aucun serveur public pour l’instant. Crée-en un et tes amis (ou n’importe qui) pourront rejoindre !'],
  ['Install the app', 'Instala la app', 'Instale o app', "Installer l'appli"],
  ['Create server', 'Crear servidor', 'Criar servidor', 'Créer un serveur'],
  ['Cancel', 'Cancelar', 'Cancelar', 'Annuler'],
  ['Server name', 'Nombre del servidor', 'Nome do servidor', 'Nom du serveur'],
  ['Visibility', 'Visibilidad', 'Visibilidade', 'Visibilité'],
  ['🌐 Public', '🌐 Público', '🌐 Público', '🌐 Public'],
  ['🔒 Private', '🔒 Privado', '🔒 Privado', '🔒 Privé'],
  ['Hidden from the list. Friends join with the code or invite link.', 'Oculto de la lista. Tus amigos entran con el código o el enlace.', 'Oculto da lista. Amigos entram com o código ou o link.', 'Caché de la liste. Tes amis rejoignent avec le code ou le lien.'],
  ['Max players', 'Jugadores máximos', 'Máximo de jogadores', 'Joueurs max'],
  ['Fill with bots', 'Rellenar con bots', 'Completar com bots', 'Compléter avec des bots'],
  ['No bots', 'Sin bots', 'Sem bots', 'Pas de bots'],
  ['Bots leave as real players join.', 'Los bots se van cuando entran jugadores reales.', 'Os bots saem quando jogadores reais entram.', 'Les bots partent quand de vrais joueurs arrivent.'],
  ['Region tag', 'Región', 'Região', 'Région'],
  ['Rules', 'Reglas', 'Regras', 'Règles'],
  ['Rotate maps after each match', 'Cambiar de mapa tras cada partida', 'Trocar de mapa após cada partida', 'Changer de carte après chaque partie'],
  ['Game mode', 'Modo de juego', 'Modo de jogo', 'Mode de jeu'],
  ['Starting map', 'Mapa inicial', 'Mapa inicial', 'Carte de départ'],
  ['teams', 'equipos', 'equipes', 'équipes'],

  // ---- Modes ----
  ['Free For All', 'Todos contra todos', 'Todos contra todos', 'Chacun pour soi'],
  ['Team Deathmatch', 'Duelo por equipos', 'Mata-mata em equipe', 'Match à mort par équipe'],
  ['Gun Game', 'Gun Game', 'Gun Game', 'Gun Game'],
  ['King of the Hill', 'Rey de la colina', 'Rei da colina', 'Roi de la colline'],
  ['Infection', 'Infección', 'Infecção', 'Infection'],
  ['Capture the Flag', 'Captura la bandera', 'Capture a bandeira', 'Capture du drapeau'],
  ['Domination', 'Dominación', 'Dominação', 'Domination'],
  ['Kill Confirmed', 'Baja confirmada', 'Abate confirmado', 'Élimination confirmée'],
  ['Bounty Hunter', 'Cazarrecompensas', 'Caçador de recompensas', 'Chasseur de primes'],
  ['Last Man Standing', 'Último en pie', 'Último de pé', 'Dernier debout'],
  ['One in the Chamber', 'Una en la recámara', 'Uma na agulha', 'Une balle dans la chambre'],
  ['Weapon Rotation', 'Rotación de armas', 'Rotação de armas', 'Rotation des armes'],
  ['Blade Party', 'Fiesta de cuchillas', 'Festa das lâminas', 'Fête des lames'],
  ['Zombie Survival', 'Supervivencia zombi', 'Sobrevivência zumbi', 'Survie zombie'],
  ['Battle Royale', 'Battle Royale', 'Battle Royale', 'Battle Royale'],
  ['Tournament', 'Torneo', 'Torneio', 'Tournoi'],
  ['Practice Range', 'Campo de práctica', 'Estande de treino', "Stand d'entraînement"],

  // ---- Loadout / character ----
  ['One weapon per slot. Changes apply the next time you spawn.', 'Un arma por ranura. Los cambios se aplican al reaparecer.', 'Uma arma por slot. As mudanças valem no próximo respawn.', "Une arme par emplacement. Les changements s'appliquent à la prochaine apparition."],
  ['Presets', 'Predefinidos', 'Predefinições', 'Préréglages'],
  ['1 · Primary', '1 · Principal', '1 · Primária', '1 · Principale'],
  ['2 · Secondary', '2 · Secundaria', '2 · Secundária', '2 · Secondaire'],
  ['3 · Melee', '3 · Cuerpo a cuerpo', '3 · Corpo a corpo', '3 · Mêlée'],
  ['4 · Utility', '4 · Utilidad', '4 · Utilitário', '4 · Utilitaire'],
  ['Rifles', 'Rifles', 'Fuzis', 'Fusils'], ['Heavy', 'Pesadas', 'Pesadas', 'Lourdes'], ['Long range', 'Largo alcance', 'Longo alcance', 'Longue portée'],
  ['Shotguns', 'Escopetas', 'Escopetas', 'Fusils à pompe'], ['Launchers & bows', 'Lanzadores y arcos', 'Lançadores e arcos', 'Lanceurs et arcs'],
  ['Experimental', 'Experimental', 'Experimental', 'Expérimental'],
  ['Kill speed', 'Velocidad de baja', 'Velocidade de abate', "Vitesse d'élimination"], ['Fire rate', 'Cadencia', 'Cadência', 'Cadence'],
  ['Range', 'Alcance', 'Alcance', 'Portée'], ['Mobility', 'Movilidad', 'Mobilidade', 'Mobilité'], ['Damage', 'Daño', 'Dano', 'Dégâts'],
  ['Headshots', 'Disparos a la cabeza', 'Tiros na cabeça', 'Tirs à la tête'], ['Reload', 'Recarga', 'Recarga', 'Rechargement'],
  ['Drop-off', 'Caída de daño', 'Queda de dano', 'Atténuation'], ['Attachments', 'Accesorios', 'Acessórios', 'Accessoires'],
  ['Optic', 'Mira', 'Mira', 'Viseur'], ['Muzzle', 'Bocacha', 'Boca', 'Bouche'], ['Magazine', 'Cargador', 'Carregador', 'Chargeur'],
  ['Underbarrel', 'Bajo el cañón', 'Sob o cano', 'Sous le canon'], ['None', 'Ninguno', 'Nenhum', 'Aucun'], ['Camo', 'Camuflaje', 'Camuflagem', 'Camo'],
  ['More wraps →', 'Más camuflajes →', 'Mais camuflagens →', 'Plus de camos →'],
  ['Your callsign, color and cosmetics. Earn tokens from missions to unlock more.', 'Tu nombre, color y cosméticos. Gana fichas con misiones para desbloquear más.', 'Seu nome, cor e cosméticos. Ganhe fichas com missões para liberar mais.', 'Ton nom, ta couleur et tes cosmétiques. Gagne des jetons avec les missions pour en débloquer plus.'],
  ['Earn more in Missions', 'Gana más en Misiones', 'Ganhe mais em Missões', 'Gagne-en plus dans Missions'],
  ['Color', 'Color', 'Cor', 'Couleur'], ['Hats', 'Sombreros', 'Chapéus', 'Chapeaux'], ['Hair', 'Pelo', 'Cabelo', 'Cheveux'], ['Face', 'Cara', 'Rosto', 'Visage'],
  ['Back', 'Espalda', 'Costas', 'Dos'], ['Banners', 'Estandartes', 'Estandartes', 'Bannières'], ['Weapon wraps', 'Camuflajes de armas', 'Camuflagens de armas', "Camos d'armes"],
  ['Equipped', 'Equipado', 'Equipado', 'Équipé'], ['Owned', 'Tuyo', 'Seu', 'Possédé'],

  // ---- Missions ----
  ['The season pass, daily rewards and challenges, your level and missions. All of them pay tokens.', 'El pase de temporada, premios y desafíos diarios, tu nivel y misiones. Todo da fichas.', 'O passe de temporada, prêmios e desafios diários, seu nível e missões. Tudo dá fichas.', 'Le passe de saison, les récompenses et défis du jour, ton niveau et les missions. Tout rapporte des jetons.'],
  ['Daily 🎁', 'Diario 🎁', 'Diário 🎁', 'Quotidien 🎁'], ['Season & level', 'Temporada y nivel', 'Temporada e nível', 'Saison et niveau'],
  ['Daily login', 'Inicio de sesión diario', 'Login diário', 'Connexion quotidienne'],
  ["Claim today's reward", 'Reclamar el premio de hoy', 'Resgatar o prêmio de hoje', 'Récupérer la récompense du jour'],
  ['Daily challenges', 'Desafíos diarios', 'Desafios diários', 'Défis du jour'],
  ['Log in every day to grow your streak. Miss a day and it starts over at day 1.', 'Entra cada día para aumentar tu racha. Si fallas un día, vuelve al día 1.', 'Entre todo dia para aumentar sua sequência. Se faltar um dia, volta ao dia 1.', 'Connecte-toi chaque jour pour allonger ta série. Un jour manqué et tout recommence au jour 1.'],

  // ---- Leaderboard ----
  ['Top players by XP, kills, wins and headshots: this week, last week or all time, in every mode or just one.', 'Mejores jugadores por XP, bajas, victorias y disparos a la cabeza: esta semana, la anterior o de siempre, en todos los modos o en uno.', 'Melhores jogadores por XP, abates, vitórias e tiros na cabeça: esta semana, a passada ou de todos os tempos, em todos os modos ou em um.', 'Meilleurs joueurs par XP, éliminations, victoires et tirs à la tête : cette semaine, la semaine dernière ou depuis toujours, dans tous les modes ou un seul.'],
  ['This week', 'Esta semana', 'Esta semana', 'Cette semaine'], ['Last week', 'Semana pasada', 'Semana passada', 'Semaine dernière'],
  ['All time', 'Histórico', 'Geral', 'Tous les temps'], ['All modes', 'Todos los modos', 'Todos os modos', 'Tous les modes'],
  ['Lifetime totals', 'Totales de siempre', 'Totais de sempre', 'Totaux depuis toujours'], ['Final results', 'Resultados finales', 'Resultados finais', 'Résultats finaux'],
  ['⭐ XP', '⭐ XP', '⭐ XP', '⭐ XP'], ['💀 Kills', '💀 Bajas', '💀 Abates', '💀 Éliminations'], ['🏆 Wins', '🏆 Victorias', '🏆 Vitórias', '🏆 Victoires'],
  ['🎯 Headshots', '🎯 A la cabeza', '🎯 Na cabeça', '🎯 À la tête'], ['🛡 Clans', '🛡 Clanes', '🛡 Clãs', '🛡 Clans'],
  ['Your week', 'Tu semana', 'Sua semana', 'Ta semaine'],
  ["Last week's champions", 'Campeones de la semana pasada', 'Campeões da semana passada', 'Champions de la semaine dernière'],
  ['No champions yet.', 'Aún no hay campeones.', 'Ainda não há campeões.', 'Pas encore de champions.'],

  // ---- Friends ----
  ['Add friends by gamertag, see who\'s online, party up and chat.', 'Añade amigos por gamertag, mira quién está conectado, forma grupo y chatea.', 'Adicione amigos pelo gamertag, veja quem está online, forme grupo e converse.', 'Ajoute des amis par gamertag, vois qui est en ligne, fais un groupe et discute.'],
  ['Pick a gamertag so friends can find you.', 'Elige un gamertag para que tus amigos te encuentren.', 'Escolha um gamertag para seus amigos te acharem.', 'Choisis un gamertag pour que tes amis te trouvent.'],
  ['Choose gamertag', 'Elegir gamertag', 'Escolher gamertag', 'Choisir un gamertag'],
  ['Party chat', 'Chat de grupo', 'Chat do grupo', 'Chat de groupe'],

  // ---- Settings ----
  ['SETTINGS', 'AJUSTES', 'CONFIGURAÇÕES', 'PARAMÈTRES'], ['Done', 'Listo', 'Pronto', 'OK'],
  ['Controls', 'Controles', 'Controles', 'Commandes'], ['Controller', 'Mando', 'Controle', 'Manette'], ['Video', 'Video', 'Vídeo', 'Vidéo'],
  ['HUD & Audio', 'HUD y audio', 'HUD e áudio', 'HUD et audio'], ['Accessibility', 'Accesibilidad', 'Acessibilidade', 'Accessibilité'],
  ['Mobile', 'Móvil', 'Celular', 'Mobile'], ['Customize', 'Personalizar', 'Personalizar', 'Personnaliser'],
  ['Language', 'Idioma', 'Idioma', 'Langue'],
  ['Menus, settings and the HUD. Auto uses the language your browser is set to', 'Menús, ajustes y HUD. Auto usa el idioma de tu navegador', 'Menus, configurações e HUD. Auto usa o idioma do seu navegador', 'Menus, paramètres et HUD. Auto utilise la langue de ton navigateur'],
  ['Mouse sensitivity', 'Sensibilidad del ratón', 'Sensibilidade do mouse', 'Sensibilité de la souris'],
  ['Aiming sensitivity', 'Sensibilidad al apuntar', 'Sensibilidade ao mirar', 'Sensibilité en visée'],
  ['Multiplier while aiming down sights', 'Multiplicador al apuntar con la mira', 'Multiplicador ao mirar pela mira', 'Multiplicateur en visée'],
  ['Invert look up / down', 'Invertir eje vertical', 'Inverter eixo vertical', "Inverser l'axe vertical"],
  ['Toggle aim with right mouse', 'Alternar apuntado con clic derecho', 'Alternar mira com botão direito', 'Visée en bascule (clic droit)'],
  ['Click once to aim, again to stop (instead of holding)', 'Un clic para apuntar, otro para dejar de hacerlo (en vez de mantener)', 'Um clique para mirar, outro para parar (em vez de segurar)', 'Un clic pour viser, un autre pour arrêter (au lieu de maintenir)'],
  ['Key bindings', 'Asignación de teclas', 'Atalhos de teclas', 'Touches'],
  ['Move forward', 'Avanzar', 'Andar para frente', 'Avancer'], ['Move back', 'Retroceder', 'Andar para trás', 'Reculer'],
  ['Move left', 'Izquierda', 'Esquerda', 'Gauche'], ['Move right', 'Derecha', 'Direita', 'Droite'], ['Jump', 'Saltar', 'Pular', 'Sauter'],
  ['Crouch / slide', 'Agacharse / deslizarse', 'Agachar / deslizar', "S'accroupir / glisser"], ['Sprint', 'Correr', 'Correr', 'Sprinter'],
  ['Last weapon', 'Última arma', 'Última arma', 'Dernière arme'], ['Primary', 'Principal', 'Primária', 'Principale'], ['Secondary', 'Secundaria', 'Secundária', 'Secondaire'],
  ['Melee weapon', 'Arma cuerpo a cuerpo', 'Arma corpo a corpo', 'Arme de mêlée'], ['Utility', 'Utilidad', 'Utilitário', 'Utilitaire'],
  ['Quick grenade', 'Granada rápida', 'Granada rápida', 'Grenade rapide'], ['Quick melee', 'Golpe rápido', 'Golpe rápido', 'Mêlée rapide'],
  ['Inspect weapon', 'Inspeccionar arma', 'Inspecionar arma', "Inspecter l'arme"], ['Ping (team modes)', 'Marcar (modos por equipos)', 'Marcar (modos em equipe)', 'Ping (modes en équipe)'],
  ['Scoreboard', 'Marcador', 'Placar', 'Tableau des scores'], ['Chat', 'Chat', 'Chat', 'Chat'],
  ['Push to talk (party voice)', 'Pulsar para hablar (voz)', 'Apertar para falar (voz)', 'Appuyer pour parler (voix)'],
  ['Reset keys to default', 'Restablecer teclas', 'Restaurar teclas', 'Touches par défaut'],
  ['Reset all to defaults', 'Restablecer todo', 'Restaurar tudo', 'Tout réinitialiser'],
  ['Look sensitivity', 'Sensibilidad de la vista', 'Sensibilidade da visão', 'Sensibilité de la vue'],
  ['Stick dead zone', 'Zona muerta del stick', 'Zona morta do analógico', 'Zone morte du stick'],
  ['Aim assist', 'Asistencia de apuntado', 'Assistência de mira', 'Aide à la visée'],
  ['Aim assist strength', 'Fuerza de la asistencia', 'Força da assistência', "Force de l'aide à la visée"],
  ['Crouch toggles', 'Agacharse alterna', 'Agachar alterna', "S'accroupir en bascule"],
  ['Vibration', 'Vibración', 'Vibração', 'Vibration'], ['Button layout', 'Distribución de botones', 'Layout dos botões', 'Disposition des boutons'],
  ['Field of view', 'Campo de visión', 'Campo de visão', 'Champ de vision'],
  ['Weapon field of view', 'Campo de visión del arma', 'Campo de visão da arma', "Champ de vision de l'arme"],
  ['How large your gun and arms look', 'Lo grandes que se ven tu arma y tus brazos', 'O tamanho da sua arma e dos braços', 'La taille de ton arme et de tes bras'],
  ['View bobbing', 'Balanceo de cámara', 'Balanço da câmera', 'Balancement de la vue'],
  ['Graphics', 'Gráficos', 'Gráficos', 'Graphismes'], ['Low-end', 'Muy bajo', 'Muito baixo', 'Très bas'], ['Low', 'Bajo', 'Baixo', 'Bas'],
  ['Normal', 'Normal', 'Normal', 'Normal'], ['High', 'Alto', 'Alto', 'Élevé'],
  ['Auto resolution', 'Resolución automática', 'Resolução automática', 'Résolution auto'],
  ['Lowers the resolution a little when the game slows down, so it stays smooth', 'Baja un poco la resolución cuando el juego va lento para que siga fluido', 'Reduz um pouco a resolução quando o jogo fica lento, para continuar fluido', 'Baisse un peu la résolution quand le jeu ralentit, pour rester fluide'],
  ['Record highlight clips', 'Grabar mejores jugadas', 'Gravar melhores jogadas', 'Enregistrer les meilleurs moments'],
  ['Kill cam', 'Cámara de muerte', 'Câmera de abate', 'Kill cam'],
  ["When you die, replay the last few seconds from your killer's eyes (any key or tap skips it)", 'Al morir, repite los últimos segundos desde los ojos de quien te mató (cualquier tecla o toque lo salta)', 'Ao morrer, repete os últimos segundos pelos olhos de quem te matou (qualquer tecla ou toque pula)', "À ta mort, revois les dernières secondes à travers les yeux de ton tueur (une touche ou un appui pour passer)"],
  ['Blood effects', 'Efectos de sangre', 'Efeitos de sangue', 'Effets de sang'],
  ['Off: hits and kills show grey sparks instead of red blood', 'Desactivado: los impactos muestran chispas grises en vez de sangre', 'Desligado: acertos mostram faíscas cinzas em vez de sangue', 'Désactivé : les impacts montrent des étincelles grises au lieu du sang'],
  ['Show FPS counter', 'Mostrar FPS', 'Mostrar FPS', 'Afficher les FPS'], ['Volume', 'Volumen', 'Volume', 'Volume'],
  ['Show party chat', 'Mostrar chat', 'Mostrar chat', 'Afficher le chat'],
  ['Turn off to hide all chat messages', 'Desactívalo para ocultar todos los mensajes', 'Desligue para esconder todas as mensagens', 'Désactive pour masquer tous les messages'],
  ['Voice chat volume', 'Volumen del chat de voz', 'Volume do chat de voz', 'Volume du chat vocal'], ['Push to talk', 'Pulsar para hablar', 'Apertar para falar', 'Appuyer pour parler'],
  ['Minimap', 'Minimapa', 'Minimapa', 'Minicarte'],
  ['Shows the map, teammates, objectives and enemies who fire unsuppressed', 'Muestra el mapa, aliados, objetivos y enemigos que disparan sin silenciador', 'Mostra o mapa, aliados, objetivos e inimigos que atiram sem silenciador', 'Montre la carte, les alliés, les objectifs et les ennemis qui tirent sans silencieux'],
  ['HUD size', 'Tamaño del HUD', 'Tamanho do HUD', 'Taille du HUD'], ['Crosshair color', 'Color de la mira', 'Cor da mira', 'Couleur du réticule'],
  ['Crosshair size', 'Tamaño de la mira', 'Tamanho da mira', 'Taille du réticule'], ['Crosshair center dot', 'Punto central de la mira', 'Ponto central da mira', 'Point central du réticule'],
  ['Colorblind mode', 'Modo daltónico', 'Modo daltônico', 'Mode daltonien'],
  ['Changes team, zombie and health bar colors so they are easier to tell apart', 'Cambia los colores de equipos, zombis y la barra de vida para distinguirlos mejor', 'Muda as cores das equipes, zumbis e barra de vida para diferenciar melhor', "Change les couleurs des équipes, des zombies et de la barre de vie pour mieux les distinguer"],
  ['Off', 'No', 'Desligado', 'Désactivé'], ['Protanopia', 'Protanopía', 'Protanopia', 'Protanopie'], ['Deuteranopia', 'Deuteranopía', 'Deuteranopia', 'Deutéranopie'],
  ['Tritanopia', 'Tritanopía', 'Tritanopia', 'Tritanopie'], ['Grayscale', 'Escala de grises', 'Escala de cinza', 'Niveaux de gris'],
  ['Sound captions', 'Subtítulos de sonido', 'Legendas de som', 'Sous-titres des sons'],
  ['Shows footsteps, gunfire, reloads and explosions on screen, with an arrow pointing where they came from', 'Muestra pasos, disparos, recargas y explosiones en pantalla, con una flecha hacia su origen', 'Mostra passos, tiros, recargas e explosões na tela, com uma seta apontando de onde vieram', "Affiche les pas, tirs, rechargements et explosions à l'écran, avec une flèche vers leur origine"],
  ['Caption size', 'Tamaño de subtítulos', 'Tamanho das legendas', 'Taille des sous-titres'],
  ['Replay of how you died', 'Repetición de cómo moriste', 'Replay de como você morreu', 'Revoir comment tu es mort'],
  ['Interface mode', 'Modo de interfaz', 'Modo da interface', "Mode d'interface"], ['Auto', 'Auto', 'Auto', 'Auto'],
  ['Phone', 'Teléfono', 'Celular', 'Téléphone'], ['Tablet', 'Tableta', 'Tablet', 'Tablette'], ['Desktop', 'Ordenador', 'Computador', 'Ordinateur'],
  ['Button size', 'Tamaño de botones', 'Tamanho dos botões', 'Taille des boutons'], ['Button opacity', 'Opacidad de botones', 'Opacidade dos botões', 'Opacité des boutons'],

  // ---- Pause / match ----
  ['SERVER CREATED', 'SERVIDOR CREADO', 'SERVIDOR CRIADO', 'SERVEUR CRÉÉ'], ['PAUSED', 'EN PAUSA', 'PAUSADO', 'EN PAUSE'],
  ['Copy invite', 'Copiar invitación', 'Copiar convite', "Copier l'invitation"], ['Click to play', 'Haz clic para jugar', 'Clique para jogar', 'Clique pour jouer'],
  ['Host panel', 'Panel del anfitrión', 'Painel do anfitrião', "Panneau de l'hôte"], ['Leave', 'Salir', 'Sair', 'Quitter'],
  ['Join Game Night voice', 'Unirse a la voz de la noche de juego', 'Entrar na voz da noite de jogo', 'Rejoindre la voix de la soirée'],
  ['applies on next spawn', 'se aplica al reaparecer', 'vale no próximo respawn', "s'applique à la prochaine apparition"],
  ['Send', 'Enviar', 'Enviar', 'Envoyer'], ['to chat', 'para chatear', 'para conversar', 'pour discuter'], ['Press', 'Pulsa', 'Aperte', 'Appuie sur'],
  ['HEALTH', 'VIDA', 'VIDA', 'VIE'], ['RELOADING', 'RECARGANDO', 'RECARREGANDO', 'RECHARGEMENT'],
  ['ELIMINATED', 'ELIMINADO', 'ELIMINADO', 'ÉLIMINÉ'], ['KILLED YOU', 'TE MATÓ', 'TE MATOU', "T'A TUÉ"],
  ['Respawning…', 'Reapareciendo…', 'Renascendo…', 'Réapparition…'],
  ['RED · YOU', 'ROJO · TÚ', 'VERMELHO · VOCÊ', 'ROUGE · TOI'], ['BLUE · YOU', 'AZUL · TÚ', 'AZUL · VOCÊ', 'BLEU · TOI'],
  ['RED', 'ROJO', 'VERMELHO', 'ROUGE'], ['BLUE', 'AZUL', 'AZUL', 'BLEU'], ['YOU', 'TÚ', 'VOCÊ', 'TOI'],
  ['SCOREBOARD', 'MARCADOR', 'PLACAR', 'TABLEAU DES SCORES'], ['DRAW', 'EMPATE', 'EMPATE', 'ÉGALITÉ'],
  ['RED TEAM WINS', 'GANA EL EQUIPO ROJO', 'EQUIPE VERMELHA VENCE', "L'ÉQUIPE ROUGE GAGNE"], ['BLUE TEAM WINS', 'GANA EL EQUIPO AZUL', 'EQUIPE AZUL VENCE', "L'ÉQUIPE BLEUE GAGNE"],
  ['ZOMBIES WIN', 'GANAN LOS ZOMBIS', 'OS ZUMBIS VENCEM', 'LES ZOMBIES GAGNENT'], ['SURVIVORS WIN', 'GANAN LOS SUPERVIVIENTES', 'OS SOBREVIVENTES VENCEM', 'LES SURVIVANTS GAGNENT'],
  ['MATCH OVER', 'PARTIDA TERMINADA', 'FIM DE PARTIDA', 'PARTIE TERMINÉE'],
  ['THE STORM IS CLOSING IN', 'LA TORMENTA SE CIERRA', 'A TEMPESTADE ESTÁ FECHANDO', 'LA TEMPÊTE SE REFERME'],
  ['ELIMINATED FROM THE TOURNAMENT', 'ELIMINADO DEL TORNEO', 'ELIMINADO DO TORNEIO', 'ÉLIMINÉ DU TOURNOI'],
  ['TOURNAMENT FINAL · FIRST TO 7', 'FINAL DEL TORNEO · EL PRIMERO A 7', 'FINAL DO TORNEIO · PRIMEIRO A 7', 'FINALE DU TOURNOI · PREMIER À 7'],
  ['DOWN · BACK WHEN THE WAVE IS CLEARED', 'CAÍDO · VUELVES AL SUPERAR LA OLEADA', 'CAÍDO · VOLTA QUANDO A ONDA ACABAR', 'À TERRE · RETOUR À LA FIN DE LA VAGUE'],
  ['Downed · back when your team clears the wave', 'Caído · vuelves cuando tu equipo supere la oleada', 'Caído · volta quando sua equipe acabar a onda', 'À terre · retour quand ton équipe finit la vague'],
  ['Eliminated · spectating until the round ends', 'Eliminado · espectador hasta que acabe la ronda', 'Eliminado · assistindo até a rodada acabar', "Éliminé · spectateur jusqu'à la fin de la manche"],
  ['Out of the tournament · spectating', 'Fuera del torneo · espectador', 'Fora do torneio · assistindo', 'Hors du tournoi · spectateur'],
  ['Out of lives · spectating until the next round', 'Sin vidas · espectador hasta la próxima ronda', 'Sem vidas · assistindo até a próxima rodada', "Plus de vies · spectateur jusqu'à la prochaine manche"],
  ['You took yourself out', 'Te eliminaste tú mismo', 'Você se eliminou', "Tu t'es éliminé toi-même"],
  ['Pings work in team modes', 'Las marcas funcionan en modos por equipos', 'Marcações funcionam em modos de equipe', 'Les pings marchent en mode équipe'],
  ['Ping cooling down', 'Marca en recarga', 'Marcação recarregando', 'Ping en recharge'],
  ['◉ KILL CAM', '◉ CÁMARA DE MUERTE', '◉ CÂMERA DE ABATE', '◉ KILL CAM'], ['Any key or tap to skip', 'Cualquier tecla o toque para saltar', 'Qualquer tecla ou toque para pular', 'Une touche ou un appui pour passer'],
  ['ENEMY', 'ENEMIGO', 'INIMIGO', 'ENNEMI'],
  ['Footsteps', 'Pasos', 'Passos', 'Pas'], ['Running', 'Corriendo', 'Correndo', 'Course'], ['Gunfire', 'Disparos', 'Tiros', 'Tirs'],
  ['Quiet gunfire', 'Disparos silenciados', 'Tiros silenciados', 'Tirs silencieux'], ['Reloading', 'Recargando', 'Recarregando', 'Rechargement'],
  ['Melee swing', 'Golpe', 'Golpe', 'Coup de mêlée'], ['Explosion', 'Explosión', 'Explosão', 'Explosion'], ['Flashbang', 'Cegadora', 'Granada de luz', 'Flash'],
  ['Smoke grenade', 'Granada de humo', 'Granada de fumaça', 'Fumigène'], ['Sticky grenade beeping', 'Granada adhesiva pitando', 'Granada adesiva apitando', 'Grenade collante qui bipe'],
];

// Text with numbers or names in it: [pattern, Spanish, Portuguese, French] ($1… are kept).
const PATTERNS = [
  [/^Day (\d+) reward$/, 'Premio del día $1', 'Prêmio do dia $1', 'Récompense du jour $1'],
  [/^Day (\d+)$/, 'Día $1', 'Dia $1', 'Jour $1'],
  [/^Challenges (\d+)\/(\d+)$/, 'Desafíos $1/$2', 'Desafios $1/$2', 'Défis $1/$2'],
  [/^Missions (\d+)\/(\d+)$/, 'Misiones $1/$2', 'Missões $1/$2', 'Missions $1/$2'],
  [/^New in (.+)$/, 'Nuevos en $1', 'Novos em $1', 'Nouveaux dans $1'],
  [/^Placement (\d+)\/(\d+)$/, 'Clasificación $1/$2', 'Classificatória $1/$2', 'Placement $1/$2'],
  [/^Featured today · (.+)$/, 'Destacado hoy · $1', 'Destaque hoje · $1', 'À la une · $1'],
  [/^featured today · (.+)$/, 'destacado hoy · $1', 'destaque hoje · $1', 'à la une · $1'],
  [/^(\d+) playing on (\d+) servers?$/, '$1 jugando en $2 servidor(es)', '$1 jogando em $2 servidor(es)', '$1 en jeu sur $2 serveur(s)'],
  [/^Learn the controls in the Practice Range · (.+)$/, 'Aprende los controles en el campo de práctica · $1', 'Aprenda os controles no estande de treino · $1', "Apprends les commandes au stand d'entraînement · $1"],
  [/^Season tier (\d+) · (.+) XP to go$/, 'Nivel de temporada $1 · faltan $2 XP', 'Nível da temporada $1 · faltam $2 XP', 'Palier de saison $1 · encore $2 XP'],
  [/^in (\S+) · (.+)$/, 'en $1 · $2', 'em $1 · $2', 'dans $1 · $2'],
  [/^Respawning in (\d+)$/, 'Reapareciendo en $1', 'Renascendo em $1', 'Réapparition dans $1'],
  [/^(\d+) players$/, '$1 jugadores', '$1 jogadores', '$1 joueurs'],
  [/^Up to (\d+) players$/, 'Hasta $1 jugadores', 'Até $1 jogadores', "Jusqu'à $1 joueurs"],
  [/^(.+) joined$/, '$1 se unió', '$1 entrou', '$1 a rejoint'],
  [/^(.+) left$/, '$1 se fue', '$1 saiu', '$1 est parti'],
  [/^(\w+) · FIRST TO (\d+)$/, '$1 · EL PRIMERO A $2', '$1 · PRIMEIRO A $2', '$1 · PREMIER À $2'],
  [/^WAVE (\d+)$/, 'OLEADA $1', 'ONDA $1', 'VAGUE $1'],
  [/^WAVE (\d+) CLEARED · NEXT IN (\d+)s$/, 'OLEADA $1 SUPERADA · SIGUIENTE EN $2s', 'ONDA $1 CONCLUÍDA · PRÓXIMA EM $2s', 'VAGUE $1 TERMINÉE · SUIVANTE DANS $2s'],
  [/^(.+) WINS$/, '$1 GANA', '$1 VENCE', '$1 GAGNE'],
  [/^SURVIVED (\d+) WAVES?$/, 'SOBREVIVISTE $1 OLEADAS', 'SOBREVIVEU A $1 ONDAS', '$1 VAGUES SURVÉCUES'],
  [/^ELIMINATED · #(\d+)$/, 'ELIMINADO · #$1', 'ELIMINADO · #$1', 'ÉLIMINÉ · #$1'],
  [/^(\d+) PLAYERS LEFT$/, 'QUEDAN $1 JUGADORES', 'RESTAM $1 JOGADORES', 'PLUS QUE $1 JOUEURS'],
  [/^(.+) WINS THE BATTLE ROYALE$/, '$1 GANA EL BATTLE ROYALE', '$1 VENCE O BATTLE ROYALE', '$1 GAGNE LE BATTLE ROYALE'],
  [/^(.+) IS THE TOURNAMENT CHAMPION$/, '$1 ES EL CAMPEÓN DEL TORNEO', '$1 É O CAMPEÃO DO TORNEIO', '$1 EST LE CHAMPION DU TOURNOI'],
  [/^ROUND (\d+): (\d+) GO THROUGH$/, 'RONDA $1: PASAN $2', 'RODADA $1: $2 AVANÇAM', 'MANCHE $1 : $2 QUALIFIÉS'],
  [/^10 MINS UNTIL TOURNAMENT · LEAVE SOON IF YOU DON'T WANT TO PARTICIPATE$/, 'TORNEO EN 10 MIN · SAL PRONTO SI NO QUIERES PARTICIPAR', 'TORNEIO EM 10 MIN · SAIA LOGO SE NÃO QUISER PARTICIPAR', 'TOURNOI DANS 10 MIN · PARS VITE SI TU NE VEUX PAS PARTICIPER'],
  [/^Resets in (.+) \(Monday, (.+) your time\)$/, 'Se reinicia en $1 (lunes, $2 hora local)', 'Reinicia em $1 (segunda, $2 no seu horário)', 'Remise à zéro dans $1 (lundi, $2 heure locale)'],
];

let lang = 'en', dict = null, pats = [], observer = null;
const textState = new WeakMap(); // text node -> { src (English), out (what we wrote) }
const attrState = new WeakMap(); // element -> { placeholder: { src, out } }
const SKIP = '#chat-log, #chat-input, .no-tr, [contenteditable], textarea, input, script, style, .pf-link, .lb-table td:not(.lb-empty), .sv-main b, .pt-chip';

function translate(s) {
  const k = s.trim();
  if (!k) return null;
  let to = dict.get(k);
  if (!to) for (const [re, rep] of pats) if (re.test(k)) { to = k.replace(re, rep); break; }
  return to ? s.replace(k, to) : null;
}

function fixText(n, force = false) {
  const pe = n.parentElement;
  if (!pe || pe.closest(SKIP)) return;
  let st = textState.get(n);
  const cur = n.nodeValue;
  if (st && cur === st.out) { if (!force) return; } // ours (re-done when the language changes)
  else st = { src: cur, out: cur };
  const t = dict ? translate(st.src) : null;
  st.out = t || st.src;
  textState.set(n, st);
  if (n.nodeValue !== st.out) n.nodeValue = st.out;
}
function fixAttr(el, force = false) {
  if (!el.hasAttribute || !el.hasAttribute('placeholder') || el.closest('#chat-log')) return;
  const map = attrState.get(el) || {};
  const cur = el.getAttribute('placeholder');
  let st = map.placeholder;
  if (st && cur === st.out) { if (!force) return; } else st = { src: cur, out: cur };
  const t = dict ? translate(st.src) : null;
  st.out = t || st.src;
  map.placeholder = st;
  attrState.set(el, map);
  if (cur !== st.out) el.setAttribute('placeholder', st.out);
}
function walk(root, force = false) {
  if (root.nodeType === 3) { fixText(root, force); return; }
  if (root.nodeType !== 1) return;
  if (root.matches && root.matches('#chat-log, script, style')) return;
  fixAttr(root, force);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) { if (n.nodeType === 3) fixText(n, force); else fixAttr(n, force); }
}

export function resolveLang(id = opts.lang) {
  if (id && id !== 'auto') return IDS.includes(id) ? id : 'en';
  const nav = String(navigator.language || 'en').slice(0, 2).toLowerCase();
  return IDS.includes(nav) ? nav : 'en';
}

function apply() {
  const next = resolveLang();
  if (next === lang && observer) return;
  lang = next;
  document.documentElement.lang = lang;
  const i = IDS.indexOf(lang) + 1;
  dict = i ? new Map(ROWS.map((r) => [r[0], r[i]])) : null;
  pats = i ? PATTERNS.map((p) => [p[0], p[i]]) : [];
  walk(document.body, true); // also puts English back when switching to it
  if (dict && !observer) {
    observer = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttr(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder'] });
  } else if (!dict && observer) { observer.disconnect(); observer = null; }
}

export function initI18n() { onOpts((o, key) => { if (!key || key === 'lang') apply(); }); }
