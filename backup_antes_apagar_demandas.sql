-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: mysql-2587dce8-vickysantiago220-6548.c.aivencloud.com    Database: defaultdb
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '5ed54aff-9fe6-11f1-88c3-fad8ed97a473:1-78';

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (3,'ABHO - ASSOCIAÇÃO BRASILEIRA DE HIGIENISTAS OCUPACIONAIS','secretaria@abho.org.br',1,'2026-08-24 21:49:12','2026-08-24 21:49:12');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `demand_history`
--

DROP TABLE IF EXISTS `demand_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `demand_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `demand_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `new_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_history_demand` (`demand_id`),
  KEY `fk_history_user` (`user_id`),
  CONSTRAINT `fk_history_demand` FOREIGN KEY (`demand_id`) REFERENCES `demands` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `demand_history`
--

LOCK TABLES `demand_history` WRITE;
/*!40000 ALTER TABLE `demand_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `demand_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `demands`
--

DROP TABLE IF EXISTS `demands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `demands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `number` int NOT NULL,
  `problem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `treatment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `analysis_hours` decimal(10,2) DEFAULT '0.00',
  `required_hours` decimal(10,2) DEFAULT '0.00',
  `priority` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Média',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Pendente',
  `approval` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Pendente',
  `approved_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by_user_id` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `paid` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `client_id` int DEFAULT NULL,
  `responsible` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approval_by_user_id` int DEFAULT NULL,
  `approval_at` datetime DEFAULT NULL,
  `rejection_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `execution_month` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_demands_client` (`client_id`),
  CONSTRAINT `fk_demands_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `demands`
--

LOCK TABLES `demands` WRITE;
/*!40000 ALTER TABLE `demands` DISABLE KEYS */;
INSERT INTO `demands` VALUES (21,1,'Cupons de Desconto ÔÇö listagem com ordena├º├úo e filtros inadequados, dificultando a gest├úo dos registros.','Alterar ordena├º├úo padr├úo (ID decrescente), exibir por padr├úo apenas cupons ativos, adicionar filtro por status (Ativo/Inativo/Exclu├¡do logicamente/Todos), adicionar filtro de pesquisa por nome, ajustes e valida├º├Áes de consulta e interface.',0.00,6.00,'M├®dia','N├úo iniciado','Aprovado/Setembro',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-09-01'),(22,2,'Aus├¬ncia de ambiente de homologa├º├úo, impedindo testes seguros antes da publica├º├úo em produ├º├úo.','Configurar servidor VPS Hostinger KVM 4, aplicar hardening de seguran├ºa, configurar firewall, instalar servi├ºos necess├írios, criar bancos de dados (Site ABHO e Chat ABHO), publicar ambientes de homologa├º├úo (Site e Chat), configurar dom├¡nios/subdom├¡nios e SSL, e realizar testes de acesso e funcionamento.',0.00,16.00,'**Alta**','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(23,3,'Reativa├º├úo de Assinaturas ÔÇö membro com pagamento cancelado ou assinatura cancelada n├úo consegue realizar nova contrata├º├úo (sistema retorna erro).','Analisar regras atuais de assinatura, ajustar o fluxo para permitir nova contrata├º├úo ap├│s cancelamento, tratar assinaturas canceladas e pagamentos n├úo conclu├¡dos, e realizar testes de regress├úo do fluxo.',0.00,8.00,'**Alta**','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(24,4,'Regenera├º├úo de Boletos ÔÇö quando o boleto n├úo ├® pago, o sistema n├úo permite emiss├úo de um novo, impedindo a continuidade da contrata├º├úo.','Revisar a regra de gera├º├úo de boletos, implementar mecanismo de emiss├úo de novo boleto quando o anterior estiver vencido/cancelado/n├úo pago, adicionar valida├º├Áes contra duplicidade de cobran├ºas e realizar testes de homologa├º├úo.',0.00,10.00,'**Alta**','N├úo iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(25,5,'Exporta├º├úo de Lista de Membros ÔÇö campo de endere├ºo exportado de forma unificada (endere├ºo, n├║mero, cidade, estado e CEP no mesmo campo).','Ajustar a exporta├º├úo CSV para separar os dados de endere├ºo em colunas individuais (Endere├ºo, N├║mero, Cidade, Estado, CEP), mantendo nome, e-mail e assinatura, validando a estrutura do CSV e testando com endere├ºos completos e incompletos.',0.00,4.00,'Baixa','N├úo iniciado','Aprovado/├ìnicio Agosto',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-08-01'),(26,6,'Previs├úo de hr - inclus├úo de logo','Por favor, dar andamento na inclus├úo dos logos anexos em  <br>https://abho.org.br/parceiros-2026/<br>https://abho.org.br/cbhoebho-2026/<br>em CATEGORIA Apoio Institucional...<br>Direcionar para<br><br>fieramilano.com.br/<br>anest.org.br<br>acgih.org/<br>ioha.net/<br><br>Aplicados em ordem alfab├®tica',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(27,7,'Desconto por quantidade de produto','Identificamos que existe uma falha no painel atual: hoje ele exibe apenas os descontos por categoria de membro, mas n├úo mostra os dois campos de desconto por quantidade, que seriam:<br><br>quantidade m├¡nima para desconto e valor aplicado a partir dessa quantidade m├¡nima.<br><br>Provavelmente esses metadados foram gravados por uma vers├úo ou plugin anterior e permaneceram no banco ap├│s a migra├º├úo para o tema atual, que ocorreu em algum momento.<br><br>Para corrigir, seria necess├írio reverter esse ponto adicionando novamente esses campos no painel administrativo, assim conseguimos ter controle para gerenciar e remover esses descontos quando necess├írio.',0.00,3.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(28,8,'Melhoria Chatbot','N├úo existe uma sauda├º├úo padr├úo, ent├úo vamos configurar pra fixar essa.',0.00,2.00,'M├®dia','N├úo iniciado','Aprovado/Setembro',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-09-01'),(29,9,'Altera├º├úo cadastro membro x compra site - Validar se o usu├írio pode conter multiplos endere├ºo de entrega','Manter o endere├ºo de correspond├¬ncia bloqueado no cadastro do associado<br>Durante a compra, o endere├ºo cadastral do membro n├úo deve ser atualizado automaticamente.<br>Ou seja: uma compra n├úo deve alterar os dados billing\\_address\\_1, billing\\_number, billing\\_neighborhood, billing\\_city, billing\\_state, billing\\_postcode etc. do perfil do associado.<br>Criar/reativar uma se├º├úo pr├│pria para endere├ºo de entrega<br>No checkout, deve existir uma op├º├úo do tipo:<br>ÔÇ£Enviar para outro endere├ºoÔÇØ<br>Quando marcada, o usu├írio informa um endere├ºo separado de entrega, usando campos shipping\\_*.<br>Esse endere├ºo deve valer apenas para o pedido atual, sem modificar o cadastro principal do associado.<br>Salvar o endere├ºo de entrega no pedido, n├úo no perfil do associado<br>O pedido deve guardar o endere├ºo usado naquela compra, para log├¡stica/hist├│rico.<br>Mas o perfil do membro deve permanecer com o endere├ºo de correspond├¬ncia original, salvo apenas quando ele editar explicitamente o cadastro.<br>Estimamos que para solucionar essa quest├úo leve em torno de 4 horas. Pois faremos tratamento de regras e certificaremos que n├úo ocorrer├í a altera├º├úo de endere├ºo e, ainda, salvar├í no pedido o novo endere├ºo. Nessas horas j├í ser├í contemplada tempo de teste do profissional de QA.',0.00,4.00,'M├®dia','N├úo iniciado','Aprovado/Agosto',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-08-01'),(30,10,'Estimativa de Horas ÔÇô Desenvolvimento da Tela de Programa├º├úo<br>','Conforme alinhado, conclu├¡ o levantamento inicial da demanda juntamente com a Victoria. Ela ainda realizar├í alguns ajustes no prot├│tipo, mas j├í conseguimos estimar o esfor├ºo necess├írio para esta atividade.<br><br>A estimativa ficou da seguinte forma:<br><br>1 hora para elabora├º├úo do prot├│tipo/rascunho da tela;<br>4 horas para o desenvolvimento da tela.<br><br>Essa estimativa contempla tanto a constru├º├úo do prot├│tipo quanto o desenvolvimento da tela em programa├º├úo.',0.00,5.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(31,11,'Webhook WooCommerce ÔÇöStatus de Pagamento / Status retornados pelo WooCommerce via webhook n├úo s├úo tratados corretamente.','Revisar todos os webhooks configurados, mapear eventos de pagamento e implementar atualiza├º├úo autom├ítica de status.',0.00,5.00,'Alta','N├úo iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(32,12,'Cancelamento de Assinatura ÔÇöPedido em Aguardando','Automatizar a sincroniza├º├úo de status entre assinatura cancelada e pedido correspondente no WooCommerce. Quando executa assinatura para ser membro e n├úo efetua o pagamento, o status fica em aguardando, e ao cancelar a assinatura o status do pedido segue em \"Aguardando\" impossibilitando uma nova gera├º├úo de filia├º├úo.',0.00,6.00,'Alta','N├úo iniciado','Aprovado/Agosto',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-08-01'),(33,13,'Aprova├º├úo sem Anuidade -- ├ë poss├¡vel aprovar membros sem pagamento da anuidade via tela de edi├º├úo.','Implementar valida├º├úo obrigat├│ria de pagamento antes de permitir aprova├º├úo de membros, bloqueando o fluxo sem confirma├º├úo financeira.',0.00,4.00,'M├®dia','N├úo iniciado','Aprovado/Setembro',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,'2026-09-01'),(34,14,'Link CBHO & EBHO 2026','[Diminuir o tamanho do link abho.org.br/programacao-preliminar-cbho-ebho-2026/, para https://abho.org.br/progamacao-2026/.](http://abho.org.br/programacao-preliminar-cbho-ebho-2026/)',0.00,1.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(35,15,'Campanha WhatsApp','Para viabilizar o envio da campanha via WhatsApp, ser├í necess├írio realizar a configura├º├úo da plataforma Meta Business. Para essa etapa, est├í previsto um prazo de at├® 48 horas.',0.00,48.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(36,16,'Usu├írio n├úo consegue efetuar o pagamento','O PagBank limita payment\\_method.boleto.holder.name a 30 caracteres para boleto, segundo a documenta├º├úo oficial do objeto Order. Esse pedido estava enviando:<br>SESI SERVICO SOCIAL DA INDUSTRIA = 32 caracteres<br>Por isso o PagBank recusava a cria├º├úo da cobran├ºa, mas o plugin trocava o erro real por \"There was an error during the payment.\".<br>Ajustamos para cortar esse campo para 30 caracteres via filtro pagbank\\_boleto\\_payment\\_data. Validei o payload e agora ele envia: SESI SERVICO SOCIAL DA INDUSTR = 30 caracteres',0.00,3.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(37,17,'Alterado valida├º├úo de email de plugin para PHP','N├úo estava sendo enviado email de verifica├º├úo de email',0.00,1.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(38,18,'Livro toxicologia *ATUALIZADO','Foi inserido o livro diretamente via C├│digo',0.00,2.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(39,19,'Altera├º├úo palestrantes, textos e redirecionamento pagina de programa├º├úo preliminar','Feito ajustes de imagens e textos de palestrantes, alterado redirecionamento e implementado moderados e palestras',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(40,20,'Ajuste p├ígina CBHO&EBHO 2026','- Remover Pain├®is confirmados<br>- Ajustar nomenclatura de Pain├®is para Programa├º├úo e redirecionar para Programa├º├úo Preliminar<br>- Adicionar Eventos apoiados',0.00,1.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(41,21,'Ao ir para checkout implementar a op├º├úo padr├úo para inserir frete','Atualmente, usu├írios sem endere├ºo cadastrado t├¬m a op├º├úo \"Retirada no Local\" selecionada automaticamente. A altera├º├úo ser├í solicitar apenas o CEP ao acessar o checkout (removendo os campos Pa├¡s, Estado e Bairro). Ap├│s informar o CEP, o usu├írio dever├í completar o endere├ºo antes de finalizar a compra.',0.00,2.00,'M├®dia','N├úo iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(42,22,'Alterar Sauda├º├úo do Wpp pelo Chat bot','Alterar mensagem de sauda├º├úo enviada para evitar mensagem de audio e imagens via whatsApp',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(43,23,'Adicionar modal para leitura de Livro','Atualmente a leitura do livro est├í exibindo a baixo dos livros existentes',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(44,24,'Consolida├º├úo de Usu├írios Duplicados','Adicionar regras e valida├º├Áes de usu├írios principais para unificar e excluir duplicidades e inibir novas ocorr├¬ncias.',2.50,24.00,'Alto','N├úo Iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(45,25,'Medidas de Seguran├ºa de Arquivos','Arquivos est├úo expostos para todas as pessoas em Revistas, Livros, Imagens de Usu├írios e Certificados. PDFs de livros e revistas est├úo exposta em pesquisas do google. Levantado esfor├ºo e PDF Enviado',0.00,22.00,'Cr├¡tico','N├úo Iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(46,25,'Adicionar bot├Áes novo bot├úo de redirecionamento para cursos onlines e presenciais','Atualmente contem cursos que s├úo presenciais que podem ser feito on-line, para esses cursos conter├í um novo bot├úo redirecionando para o curso on-line. E para os cursos que s├úo on-lines ter├í o redirecionamento para o curso presencial',0.00,2.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(47,26,'Fazer corre├º├Áe Pontuais - Solicitado por Raquel','Ajustar Imagem de Produto, Ajustar texto de desconto + pacotes de cursos. Alterar imagem de livro.',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(48,27,'Adicionar novo checkout de retirada para produto especifico','Atualmente n├úo existe cadastro de frete para produtos. Foi necessario implementar via codigo e registrar a forma de entrega para compra',0.00,2.00,'Alta','Finalizado','Aprovado',NULL,NULL,NULL,1,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(49,28,'Ajustar textos, imagens e moderadores de programa├º├úo pre-liminar, e adi├º├úo de parceiro em APOIO INSTITUCIONAL','Inserido corpo de texto da apresenta├º├úo de Lucas Diniz, Inserida imagem de palestrantes, e aidicionado apresentadores na Composi├º├úo da mesa. E adicionado novo Parceiro institucional APMT',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(50,29,'Ajuste de valida├º├úo de estoque na pagina de [https://abho.org.br/cbhoebho-2026/](https://abho.org.br/cbhoebho-2026/)','Mesmo ap├│s colocar que estava fora do estoque, o produto ainda exibia em uma pagina, na qual nao fazia valida├º├úo se estava fora de estoque. Foi inserida essa valida├º├úo.',0.00,1.00,'M├®dia','Finalizado','Aprovado',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL),(51,30,'Revista 83. Prever a inclus├úo da Revista anexa com o acesso exclusivo para membros. <br> <br>','Incluir a Revista somente para membros,  somente para leitura, sem possibilidade de download.',0.00,1.00,'M├®dia','N├úo Iniciado','Pendente',NULL,NULL,NULL,0,'2026-08-24 22:04:43','2026-08-24 22:04:43',3,'Otavio Cardena',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `demands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','INTERNO','CLIENTE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_client` (`client_id`),
  CONSTRAINT `fk_users_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Administrador','admin@horaflow.local','$2b$10$LeAWvHwA6zSrK1M0kBri6u08Oi1flrKm9KcTImgI/.bfhME5X.PHW','ADMIN',NULL,1,'2026-08-22 15:02:56','2026-08-22 15:02:56'),(7,'Otavio Cardena','cardenass@gmail.com','$2b$10$t7uMUjTyq4H/On3Gh7BBnOaTZxucITYw7id6WlDSoPuppB7bOlx/O','ADMIN',NULL,1,'2026-08-24 21:50:31','2026-08-24 21:50:31');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-24 19:20:12
