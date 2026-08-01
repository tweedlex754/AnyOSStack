'use strict';

// Generate the installer's localized text from ONE translation table, so the
// setup experience speaks the same twelve languages the app itself does
// (en, tr, de, fr, es, pt, it, ru, zh, ja, ar, hi). Outputs:
//   - build/anyosstack-languages.nsh  Standalone wizard: LoadLanguageFile for
//                                     each language + every wizard string as a
//                                     LangString. build/anyosstack-setup.nsi
//                                     renders these as live native labels, so
//                                     the whole wizard - not just the buttons -
//                                     follows the selected language.
//   - build/installer.nsh             electron-builder NSIS include: the
//                                     branding tagline + BrandingText.
//   - build/linux-desktop.yml         Ready-to-paste localized Name[xx]/
//                                     Comment[xx] entries for the
//                                     electron-builder `linux.desktop` block.
//
// The wizard bitmaps produced by scripts/generate-installer-ui.js deliberately
// contain NO text: baking copy into the artwork is what made every language but
// English cosmetic. Artwork = chrome, text = LangString.
//
// Run:  node scripts/build-installer-lang.js

const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');

// [app language id, NSIS language macro, NSIS .nlf file]. Kept in lockstep with
// src/renderer/i18n/langs.js - twelve languages, no Korean, Hindi included.
const LANGS = [
  ['en', 'ENGLISH', 'English'],
  ['tr', 'TURKISH', 'Turkish'],
  ['de', 'GERMAN', 'German'],
  ['fr', 'FRENCH', 'French'],
  ['es', 'SPANISH', 'Spanish'],
  ['pt', 'PORTUGUESEBR', 'PortugueseBR'],
  ['it', 'ITALIAN', 'Italian'],
  ['ru', 'RUSSIAN', 'Russian'],
  ['zh', 'SIMPCHINESE', 'SimpChinese'],
  ['ja', 'JAPANESE', 'Japanese'],
  ['ar', 'ARABIC', 'Arabic'],
  ['hi', 'HINDI', 'Hindi'],
];

// Native language names for the startup language picker (LangDLL).
const ENDONYMS = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português (Brasil)',
  it: 'Italiano',
  ru: 'Русский',
  zh: '简体中文',
  ja: '日本語',
  ar: 'العربية',
  hi: 'हिन्दी',
};

// Every string the wizard shows. "AnyOSStack" stays untranslated (brand name).
const STRINGS = {
  // ---- navigation buttons ----
  AOS_BTN_NEXT: {
    en: 'Next', tr: 'İleri', de: 'Weiter', fr: 'Suivant', es: 'Siguiente',
    pt: 'Avançar', it: 'Avanti', ru: 'Далее', zh: '下一步', ja: '次へ',
    ar: 'التالي', hi: 'आगे',
  },
  AOS_BTN_BACK: {
    en: 'Back', tr: 'Geri', de: 'Zurück', fr: 'Retour', es: 'Atrás',
    pt: 'Voltar', it: 'Indietro', ru: 'Назад', zh: '上一步', ja: '戻る',
    ar: 'رجوع', hi: 'पीछे',
  },
  AOS_BTN_CANCEL: {
    en: 'Cancel', tr: 'İptal', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar',
    pt: 'Cancelar', it: 'Annulla', ru: 'Отмена', zh: '取消', ja: 'キャンセル',
    ar: 'إلغاء', hi: 'रद्द करें',
  },
  AOS_BTN_INSTALL: {
    en: 'Install', tr: 'Kur', de: 'Installieren', fr: 'Installer', es: 'Instalar',
    pt: 'Instalar', it: 'Installa', ru: 'Установить', zh: '安装', ja: 'インストール',
    ar: 'تثبيت', hi: 'इंस्टॉल करें',
  },
  AOS_BTN_FINISH: {
    en: 'Finish', tr: 'Bitir', de: 'Fertig', fr: 'Terminer', es: 'Finalizar',
    pt: 'Concluir', it: 'Fine', ru: 'Готово', zh: '完成', ja: '完了',
    ar: 'إنهاء', hi: 'समाप्त',
  },
  AOS_BTN_BROWSE: {
    en: 'Browse', tr: 'Gözat', de: 'Durchsuchen', fr: 'Parcourir', es: 'Examinar',
    pt: 'Procurar', it: 'Sfoglia', ru: 'Обзор', zh: '浏览', ja: '参照',
    ar: 'استعراض', hi: 'ब्राउज़',
  },

  // ---- sidebar ----
  AOS_NAV_WELCOME: {
    en: 'Welcome', tr: 'Hoş geldiniz', de: 'Willkommen', fr: 'Bienvenue',
    es: 'Bienvenido', pt: 'Bem-vindo', it: 'Benvenuto', ru: 'Добро пожаловать',
    zh: '欢迎', ja: 'ようこそ', ar: 'مرحبًا', hi: 'स्वागत है',
  },
  AOS_NAV_LICENSE: {
    en: 'License', tr: 'Lisans', de: 'Lizenz', fr: 'Licence', es: 'Licencia',
    pt: 'Licença', it: 'Licenza', ru: 'Лицензия', zh: '许可证', ja: 'ライセンス',
    ar: 'الترخيص', hi: 'लाइसेंस',
  },
  AOS_NAV_DESTINATION: {
    en: 'Destination', tr: 'Konum', de: 'Zielordner', fr: 'Destination',
    es: 'Destino', pt: 'Destino', it: 'Destinazione', ru: 'Папка',
    zh: '安装位置', ja: 'インストール先', ar: 'الوجهة', hi: 'स्थान',
  },
  AOS_NAV_INSTALLATION: {
    en: 'Installation', tr: 'Kurulum', de: 'Installation', fr: 'Installation',
    es: 'Instalación', pt: 'Instalação', it: 'Installazione', ru: 'Установка',
    zh: '安装', ja: 'インストール', ar: 'التثبيت', hi: 'इंस्टॉलेशन',
  },
  AOS_NAV_FINISH: {
    en: 'Finish', tr: 'Bitiş', de: 'Abschluss', fr: 'Fin', es: 'Fin',
    pt: 'Conclusão', it: 'Fine', ru: 'Завершение', zh: '完成', ja: '完了',
    ar: 'الإنهاء', hi: 'समाप्ति',
  },
  AOS_VERSION: {
    en: 'VERSION', tr: 'SÜRÜM', de: 'VERSION', fr: 'VERSION', es: 'VERSIÓN',
    pt: 'VERSÃO', it: 'VERSIONE', ru: 'ВЕРСИЯ', zh: '版本', ja: 'バージョン',
    ar: 'الإصدار', hi: 'संस्करण',
  },

  // ---- language page ----
  AOS_LANG_TITLE: {
    en: 'Choose your language', tr: 'Dilinizi seçin', de: 'Sprache wählen',
    fr: 'Choisissez votre langue', es: 'Elige tu idioma', pt: 'Escolha o seu idioma',
    it: 'Scegli la tua lingua', ru: 'Выберите язык', zh: '选择语言',
    ja: '言語を選択', ar: 'اختر لغتك', hi: 'अपनी भाषा चुनें',
  },
  AOS_LANG_SUB: {
    en: 'The installer and the app will use this language.',
    tr: 'Kurulum ve uygulama bu dili kullanacak.',
    de: 'Installer und App verwenden diese Sprache.',
    fr: "L'assistant et l'application utiliseront cette langue.",
    es: 'El instalador y la aplicación usarán este idioma.',
    pt: 'O instalador e o aplicativo usarão este idioma.',
    it: "Il programma di installazione e l'app useranno questa lingua.",
    ru: 'Установщик и приложение будут использовать этот язык.',
    zh: '安装程序和应用将使用该语言。',
    ja: 'インストーラーとアプリはこの言語を使用します。',
    ar: 'سيستخدم المثبّت والتطبيق هذه اللغة.',
    hi: 'इंस्टॉलर और ऐप इसी भाषा का उपयोग करेंगे।',
  },

  AOS_CONFIRM_CANCEL: {
    en: 'Cancel the AnyOSStack installation?',
    tr: 'AnyOSStack kurulumundan çıkılsın mı?',
    de: 'Installation von AnyOSStack abbrechen?',
    fr: "Annuler l'installation d'AnyOSStack ?",
    es: '¿Cancelar la instalación de AnyOSStack?',
    pt: 'Cancelar a instalação do AnyOSStack?',
    it: "Annullare l'installazione di AnyOSStack?",
    ru: 'Отменить установку AnyOSStack?',
    zh: '要取消安装 AnyOSStack 吗？',
    ja: 'AnyOSStack のインストールを中止しますか？',
    ar: 'هل تريد إلغاء تثبيت AnyOSStack؟',
    hi: 'क्या AnyOSStack इंस्टॉलेशन रद्द करें?',
  },

  // ---- uninstaller ----
  AOS_UN_TITLE: {
    en: 'Remove AnyOSStack', tr: "AnyOSStack'i kaldır", de: 'AnyOSStack entfernen',
    fr: 'Supprimer AnyOSStack', es: 'Desinstalar AnyOSStack', pt: 'Remover o AnyOSStack',
    it: 'Rimuovi AnyOSStack', ru: 'Удаление AnyOSStack', zh: '卸载 AnyOSStack',
    ja: 'AnyOSStack をアンインストール', ar: 'إزالة AnyOSStack', hi: 'AnyOSStack हटाएँ',
  },
  AOS_UN_SUB: {
    en: 'The application will be removed from the folder below.',
    tr: 'Uygulama aşağıdaki klasörden kaldırılacak.',
    de: 'Die Anwendung wird aus dem folgenden Ordner entfernt.',
    fr: "L'application sera supprimée du dossier ci-dessous.",
    es: 'La aplicación se eliminará de la carpeta indicada.',
    pt: 'O aplicativo será removido da pasta abaixo.',
    it: "L'applicazione verrà rimossa dalla cartella indicata.",
    ru: 'Приложение будет удалено из указанной папки.',
    zh: '应用将从下面的文件夹中移除。',
    ja: 'アプリは以下のフォルダーから削除されます。',
    ar: 'سيتم إزالة التطبيق من المجلد أدناه.',
    hi: 'एप्लिकेशन नीचे दिए गए फ़ोल्डर से हटा दिया जाएगा।',
  },
  AOS_UN_FOLDER: {
    en: 'INSTALLED IN', tr: 'KURULU OLDUĞU KLASÖR', de: 'INSTALLIERT IN',
    fr: 'INSTALLÉ DANS', es: 'INSTALADO EN', pt: 'INSTALADO EM',
    it: 'INSTALLATO IN', ru: 'УСТАНОВЛЕНО В', zh: '安装位置',
    ja: 'インストール先', ar: 'مثبّت في', hi: 'इंस्टॉल स्थान',
  },
  AOS_UN_DONE_TITLE: {
    en: 'AnyOSStack removed', tr: 'AnyOSStack kaldırıldı', de: 'AnyOSStack entfernt',
    fr: 'AnyOSStack supprimé', es: 'AnyOSStack desinstalado', pt: 'AnyOSStack removido',
    it: 'AnyOSStack rimosso', ru: 'AnyOSStack удалён', zh: 'AnyOSStack 已卸载',
    ja: 'AnyOSStack を削除しました', ar: 'تمت إزالة AnyOSStack', hi: 'AnyOSStack हटा दिया गया',
  },
  AOS_UN_DONE_SUB: {
    en: 'The application and its shortcuts have been removed from this computer.',
    tr: 'Uygulama ve kısayolları bu bilgisayardan kaldırıldı.',
    de: 'Die Anwendung und ihre Verknüpfungen wurden entfernt.',
    fr: "L'application et ses raccourcis ont été supprimés de cet ordinateur.",
    es: 'La aplicación y sus accesos directos se han eliminado de este equipo.',
    pt: 'O aplicativo e seus atalhos foram removidos deste computador.',
    it: "L'applicazione e i suoi collegamenti sono stati rimossi da questo computer.",
    ru: 'Приложение и его ярлыки удалены с этого компьютера.',
    zh: '应用及其快捷方式已从此电脑中移除。',
    ja: 'アプリとショートカットをこのコンピューターから削除しました。',
    ar: 'تمت إزالة التطبيق واختصاراته من هذا الكمبيوتر.',
    hi: 'एप्लिकेशन और उसके शॉर्टकट इस कंप्यूटर से हटा दिए गए हैं।',
  },
  AOS_BTN_UNINSTALL: {
    en: 'Uninstall', tr: 'Kaldır', de: 'Deinstallieren', fr: 'Désinstaller',
    es: 'Desinstalar', pt: 'Desinstalar', it: 'Disinstalla', ru: 'Удалить',
    zh: '卸载', ja: 'アンインストール', ar: 'إلغاء التثبيت', hi: 'अनइंस्टॉल',
  },

  AOS_YES: {
    en: 'Yes, exit', tr: 'Evet, çık', de: 'Ja, beenden', fr: 'Oui, quitter',
    es: 'Sí, salir', pt: 'Sim, sair', it: 'Sì, esci', ru: 'Да, выйти',
    zh: '是，退出', ja: 'はい、終了', ar: 'نعم، خروج', hi: 'हाँ, बाहर',
  },
  AOS_NO: {
    en: 'Keep installing', tr: 'Kuruluma devam', de: 'Weiter installieren',
    fr: "Continuer l'installation", es: 'Seguir instalando', pt: 'Continuar instalando',
    it: 'Continua', ru: 'Продолжить', zh: '继续安装', ja: 'インストールを続行',
    ar: 'متابعة التثبيت', hi: 'इंस्टॉल जारी रखें',
  },

  // ---- welcome page ----
  AOS_W_TITLE: {
    en: 'Welcome to AnyOSStack', tr: "AnyOSStack'e hoş geldiniz",
    de: 'Willkommen bei AnyOSStack', fr: 'Bienvenue dans AnyOSStack',
    es: 'Bienvenido a AnyOSStack', pt: 'Bem-vindo ao AnyOSStack',
    it: 'Benvenuto in AnyOSStack', ru: 'Добро пожаловать в AnyOSStack',
    zh: '欢迎使用 AnyOSStack', ja: 'AnyOSStack へようこそ',
    ar: 'مرحبًا بك في AnyOSStack', hi: 'AnyOSStack में आपका स्वागत है',
  },
  AOS_W_TAGLINE: {
    en: 'One stack. Every OS.', tr: 'Tek yığın. Her işletim sistemi.',
    de: 'Ein Stack. Jedes OS.', fr: 'Une stack. Tous les OS.',
    es: 'Un stack. Todos los SO.', pt: 'Uma stack. Todos os SOs.',
    it: 'Uno stack. Ogni OS.', ru: 'Один стек. Любая ОС.',
    zh: '一套堆栈，适用所有系统。', ja: '一つのスタックで、あらゆる OS へ。',
    ar: 'حزمة واحدة لكل نظام.', hi: 'एक स्टैक। हर OS।',
  },
  AOS_W_BODY: {
    en: 'Install AnyOSStack for your Windows account.',
    tr: 'AnyOSStack Windows hesabınıza kurulacak.',
    de: 'AnyOSStack wird für Ihr Windows-Konto installiert.',
    fr: 'Installez AnyOSStack pour votre compte Windows.',
    es: 'Instala AnyOSStack para tu cuenta de Windows.',
    pt: 'Instale o AnyOSStack para a sua conta do Windows.',
    it: 'Installa AnyOSStack per il tuo account Windows.',
    ru: 'AnyOSStack будет установлен для вашей учётной записи Windows.',
    zh: '为你的 Windows 账户安装 AnyOSStack。',
    ja: 'AnyOSStack を Windows アカウントにインストールします。',
    ar: 'ثبّت AnyOSStack لحساب Windows الخاص بك.',
    hi: 'अपने Windows खाते के लिए AnyOSStack इंस्टॉल करें।',
  },
  AOS_W_NOTE: {
    en: 'Close other applications before continuing with the installation.',
    tr: 'Kuruluma devam etmeden önce diğer uygulamaları kapatın.',
    de: 'Schließen Sie andere Anwendungen, bevor Sie fortfahren.',
    fr: 'Fermez les autres applications avant de poursuivre l\'installation.',
    es: 'Cierra otras aplicaciones antes de continuar con la instalación.',
    pt: 'Feche outros aplicativos antes de continuar a instalação.',
    it: 'Chiudi le altre applicazioni prima di proseguire con l\'installazione.',
    ru: 'Закройте другие приложения перед продолжением установки.',
    zh: '继续安装前请关闭其他应用程序。',
    ja: 'インストールを続ける前に、他のアプリケーションを終了してください。',
    ar: 'أغلق التطبيقات الأخرى قبل متابعة التثبيت.',
    hi: 'इंस्टॉलेशन जारी रखने से पहले अन्य एप्लिकेशन बंद करें।',
  },
  AOS_W_HINT: {
    en: 'Select Next to continue, or Cancel to exit.',
    tr: 'Devam etmek için İleri, çıkmak için İptal seçin.',
    de: 'Wählen Sie Weiter zum Fortfahren oder Abbrechen zum Beenden.',
    fr: 'Cliquez sur Suivant pour continuer ou Annuler pour quitter.',
    es: 'Selecciona Siguiente para continuar o Cancelar para salir.',
    pt: 'Selecione Avançar para continuar ou Cancelar para sair.',
    it: 'Scegli Avanti per continuare o Annulla per uscire.',
    ru: 'Нажмите «Далее», чтобы продолжить, или «Отмена», чтобы выйти.',
    zh: '选择“下一步”继续，或选择“取消”退出。',
    ja: '「次へ」で続行、「キャンセル」で終了します。',
    ar: 'اختر "التالي" للمتابعة أو "إلغاء" للخروج.',
    hi: 'जारी रखने के लिए आगे चुनें, या बाहर निकलने के लिए रद्द करें।',
  },

  // ---- license page ----
  AOS_L_TITLE: {
    en: 'GNU General Public License v3', tr: 'GNU Genel Kamu Lisansı v3',
    de: 'GNU General Public License v3', fr: 'Licence publique générale GNU v3',
    es: 'Licencia Pública General GNU v3', pt: 'Licença Pública Geral GNU v3',
    it: 'Licenza Pubblica Generica GNU v3', ru: 'Стандартная общественная лицензия GNU v3',
    zh: 'GNU 通用公共许可证 v3', ja: 'GNU 一般公衆利用許諾書 v3',
    ar: 'رخصة جنو العمومية العامة الإصدار 3', hi: 'GNU जनरल पब्लिक लाइसेंस v3',
  },
  AOS_L_SUB: {
    en: 'Review the complete license that applies to AnyOSStack.',
    tr: "AnyOSStack için geçerli lisansın tamamını inceleyin.",
    de: 'Lesen Sie die vollständige Lizenz für AnyOSStack.',
    fr: 'Consultez la licence complète applicable à AnyOSStack.',
    es: 'Revisa la licencia completa que se aplica a AnyOSStack.',
    pt: 'Leia a licença completa aplicável ao AnyOSStack.',
    it: 'Leggi la licenza completa che si applica ad AnyOSStack.',
    ru: 'Ознакомьтесь с полным текстом лицензии AnyOSStack.',
    zh: '请阅读适用于 AnyOSStack 的完整许可证。',
    ja: 'AnyOSStack に適用されるライセンス全文をご確認ください。',
    ar: 'راجع نص الترخيص الكامل الخاص بـ AnyOSStack.',
    hi: 'AnyOSStack पर लागू पूरा लाइसेंस पढ़ें।',
  },
  AOS_L_SECTION: {
    en: 'COMPLETE LICENSE TEXT', tr: 'LİSANS METNİNİN TAMAMI',
    de: 'VOLLSTÄNDIGER LIZENZTEXT', fr: 'TEXTE COMPLET DE LA LICENCE',
    es: 'TEXTO COMPLETO DE LA LICENCIA', pt: 'TEXTO COMPLETO DA LICENÇA',
    it: 'TESTO COMPLETO DELLA LICENZA', ru: 'ПОЛНЫЙ ТЕКСТ ЛИЦЕНЗИИ',
    zh: '许可证全文', ja: 'ライセンス全文',
    ar: 'نص الترخيص الكامل', hi: 'पूरा लाइसेंस पाठ',
  },
  AOS_L_FOOT: {
    en: 'Read acknowledgement is required before installation can continue.',
    tr: 'Kurulumun devam edebilmesi için okuduğunuzu onaylamanız gerekir.',
    de: 'Eine Lesebestätigung ist erforderlich, um fortzufahren.',
    fr: 'Une confirmation de lecture est requise pour poursuivre l\'installation.',
    es: 'Se requiere confirmar la lectura antes de continuar la instalación.',
    pt: 'É necessário confirmar a leitura antes de continuar a instalação.',
    it: 'È necessaria la conferma di lettura per continuare l\'installazione.',
    ru: 'Для продолжения установки требуется подтверждение прочтения.',
    zh: '需确认已阅读后方可继续安装。',
    ja: 'インストールを続けるには既読の確認が必要です。',
    ar: 'يلزم تأكيد القراءة قبل متابعة التثبيت.',
    hi: 'इंस्टॉलेशन जारी रखने के लिए पढ़ने की पुष्टि आवश्यक है।',
  },
  AOS_LICENSE_ACK: {
    en: 'I have read the GNU GPL v3 license information',
    tr: 'GNU GPL v3 lisans bilgisini okudum',
    de: 'Ich habe die GNU-GPL-v3-Lizenzinformationen gelesen',
    fr: "J'ai lu les informations de licence GNU GPL v3",
    es: 'He leído la información de licencia GNU GPL v3',
    pt: 'Li as informações da licença GNU GPL v3',
    it: 'Ho letto le informazioni sulla licenza GNU GPL v3',
    ru: 'Я прочитал сведения о лицензии GNU GPL v3',
    zh: '我已阅读 GNU GPL v3 许可证信息',
    ja: 'GNU GPL v3 ライセンス情報を読みました',
    ar: 'لقد قرأت معلومات ترخيص GNU GPL v3',
    hi: 'मैंने GNU GPL v3 लाइसेंस जानकारी पढ़ ली है',
  },

  // ---- destination page ----
  AOS_D_TITLE: {
    en: 'Choose install location', tr: 'Kurulum konumunu seçin',
    de: 'Installationsort wählen', fr: 'Choisir le dossier d\'installation',
    es: 'Elige la ubicación de instalación', pt: 'Escolha o local de instalação',
    it: 'Scegli il percorso di installazione', ru: 'Выберите папку установки',
    zh: '选择安装位置', ja: 'インストール先を選択',
    ar: 'اختر موقع التثبيت', hi: 'इंस्टॉल स्थान चुनें',
  },
  AOS_D_SUB: {
    en: 'Select the folder where AnyOSStack will be installed.',
    tr: "AnyOSStack'in kurulacağı klasörü seçin.",
    de: 'Wählen Sie den Ordner, in dem AnyOSStack installiert wird.',
    fr: 'Sélectionnez le dossier où AnyOSStack sera installé.',
    es: 'Selecciona la carpeta donde se instalará AnyOSStack.',
    pt: 'Selecione a pasta onde o AnyOSStack será instalado.',
    it: 'Seleziona la cartella in cui installare AnyOSStack.',
    ru: 'Выберите папку, в которую будет установлен AnyOSStack.',
    zh: '选择 AnyOSStack 的安装文件夹。',
    ja: 'AnyOSStack をインストールするフォルダーを選択してください。',
    ar: 'حدد المجلد الذي سيتم تثبيت AnyOSStack فيه.',
    hi: 'वह फ़ोल्डर चुनें जहाँ AnyOSStack इंस्टॉल होगा।',
  },
  AOS_D_CARD_TITLE: {
    en: 'Install AnyOSStack', tr: "AnyOSStack'i kur", de: 'AnyOSStack installieren',
    fr: 'Installer AnyOSStack', es: 'Instalar AnyOSStack', pt: 'Instalar o AnyOSStack',
    it: 'Installa AnyOSStack', ru: 'Установка AnyOSStack', zh: '安装 AnyOSStack',
    ja: 'AnyOSStack をインストール', ar: 'تثبيت AnyOSStack', hi: 'AnyOSStack इंस्टॉल करें',
  },
  AOS_D_CARD_BODY: {
    en: 'Setup will copy the application and create Start Menu and Desktop shortcuts.',
    tr: 'Kurulum uygulamayı kopyalar, Başlat Menüsü ve Masaüstü kısayolları oluşturur.',
    de: 'Setup kopiert die Anwendung und erstellt Startmenü- und Desktop-Verknüpfungen.',
    fr: 'L\'assistant copie l\'application et crée des raccourcis Menu Démarrer et Bureau.',
    es: 'El instalador copiará la aplicación y creará accesos directos en Inicio y Escritorio.',
    pt: 'O instalador copiará o aplicativo e criará atalhos no Menu Iniciar e na Área de Trabalho.',
    it: 'Il programma copierà l\'applicazione e creerà collegamenti nel menu Start e sul Desktop.',
    ru: 'Установщик скопирует приложение и создаст ярлыки в меню «Пуск» и на рабочем столе.',
    zh: '安装程序将复制应用并创建开始菜单和桌面快捷方式。',
    ja: 'アプリをコピーし、スタートメニューとデスクトップにショートカットを作成します。',
    ar: 'سينسخ المثبّت التطبيق وينشئ اختصارات في قائمة ابدأ وسطح المكتب.',
    hi: 'सेटअप एप्लिकेशन कॉपी करेगा और स्टार्ट मेनू व डेस्कटॉप शॉर्टकट बनाएगा।',
  },
  AOS_D_FIELD: {
    en: 'INSTALL DIRECTORY', tr: 'KURULUM KLASÖRÜ', de: 'INSTALLATIONSORDNER',
    fr: 'DOSSIER D\'INSTALLATION', es: 'CARPETA DE INSTALACIÓN', pt: 'PASTA DE INSTALAÇÃO',
    it: 'CARTELLA DI INSTALLAZIONE', ru: 'ПАПКА УСТАНОВКИ', zh: '安装目录',
    ja: 'インストール先フォルダー', ar: 'مجلد التثبيت', hi: 'इंस्टॉल डायरेक्टरी',
  },
  AOS_D_FOOT: {
    en: 'PER-USER INSTALL  •  NO ADMINISTRATOR ACCESS REQUIRED',
    tr: 'KULLANICIYA ÖZEL KURULUM  •  YÖNETİCİ YETKİSİ GEREKMEZ',
    de: 'BENUTZERINSTALLATION  •  KEINE ADMINISTRATORRECHTE ERFORDERLICH',
    fr: 'INSTALLATION PAR UTILISATEUR  •  AUCUN DROIT ADMINISTRATEUR REQUIS',
    es: 'INSTALACIÓN POR USUARIO  •  NO REQUIERE PERMISOS DE ADMINISTRADOR',
    pt: 'INSTALAÇÃO POR USUÁRIO  •  NÃO REQUER ACESSO DE ADMINISTRADOR',
    it: 'INSTALLAZIONE PER UTENTE  •  NESSUN PERMESSO DI AMMINISTRATORE',
    ru: 'УСТАНОВКА ДЛЯ ПОЛЬЗОВАТЕЛЯ  •  ПРАВА АДМИНИСТРАТОРА НЕ НУЖНЫ',
    zh: '按用户安装  •  无需管理员权限',
    ja: 'ユーザー単位のインストール  •  管理者権限は不要',
    ar: 'تثبيت لكل مستخدم  •  لا يتطلب صلاحيات المسؤول',
    hi: 'प्रति-उपयोगकर्ता इंस्टॉल  •  व्यवस्थापक अनुमति आवश्यक नहीं',
  },
  AOS_D_DESKTOP: {
    en: 'Create a Desktop shortcut', tr: 'Masaüstü kısayolu oluştur',
    de: 'Desktop-Verknüpfung erstellen', fr: 'Créer un raccourci sur le Bureau',
    es: 'Crear un acceso directo en el Escritorio', pt: 'Criar atalho na Área de Trabalho',
    it: 'Crea un collegamento sul Desktop', ru: 'Создать ярлык на рабочем столе',
    zh: '创建桌面快捷方式', ja: 'デスクトップにショートカットを作成',
    ar: 'إنشاء اختصار على سطح المكتب', hi: 'डेस्कटॉप शॉर्टकट बनाएँ',
  },
  AOS_D_STARTMENU: {
    en: 'Create a Start Menu shortcut', tr: 'Başlat Menüsü kısayolu oluştur',
    de: 'Startmenü-Verknüpfung erstellen', fr: 'Créer un raccourci dans le menu Démarrer',
    es: 'Crear un acceso directo en el menú Inicio', pt: 'Criar atalho no Menu Iniciar',
    it: 'Crea un collegamento nel menu Start', ru: 'Создать ярлык в меню «Пуск»',
    zh: '创建开始菜单快捷方式', ja: 'スタートメニューにショートカットを作成',
    ar: 'إنشاء اختصار في قائمة ابدأ', hi: 'स्टार्ट मेनू शॉर्टकट बनाएँ',
  },
  AOS_CHOOSE_DIR: {
    en: 'Choose an install directory.', tr: 'Bir kurulum klasörü seçin.',
    de: 'Wählen Sie einen Installationsordner.', fr: 'Choisissez un dossier d\'installation.',
    es: 'Elige una carpeta de instalación.', pt: 'Escolha uma pasta de instalação.',
    it: 'Scegli una cartella di installazione.', ru: 'Выберите папку установки.',
    zh: '请选择安装文件夹。', ja: 'インストール先を選択してください。',
    ar: 'اختر مجلد التثبيت.', hi: 'एक इंस्टॉल फ़ोल्डर चुनें।',
  },

  // ---- installing page ----
  AOS_I_TITLE: {
    en: 'Installing Core Components', tr: 'Çekirdek bileşenler kuruluyor',
    de: 'Kernkomponenten werden installiert', fr: 'Installation des composants',
    es: 'Instalando componentes principales', pt: 'Instalando componentes principais',
    it: 'Installazione dei componenti principali', ru: 'Установка основных компонентов',
    zh: '正在安装核心组件', ja: 'コアコンポーネントをインストール中',
    ar: 'جارٍ تثبيت المكوّنات الأساسية', hi: 'मुख्य घटक इंस्टॉल हो रहे हैं',
  },
  AOS_I_SUB: {
    en: 'Deploying AnyOSStack to the selected destination',
    tr: 'AnyOSStack seçilen konuma dağıtılıyor',
    de: 'AnyOSStack wird im gewählten Zielordner bereitgestellt',
    fr: 'Déploiement d\'AnyOSStack vers le dossier choisi',
    es: 'Desplegando AnyOSStack en la ubicación seleccionada',
    pt: 'Implantando o AnyOSStack no local selecionado',
    it: 'Distribuzione di AnyOSStack nella cartella selezionata',
    ru: 'Развёртывание AnyOSStack в выбранной папке',
    zh: '正在将 AnyOSStack 部署到所选位置',
    ja: '選択した場所へ AnyOSStack を配置しています',
    ar: 'يجري نشر AnyOSStack في الموقع المحدد',
    hi: 'चयनित स्थान पर AnyOSStack तैनात किया जा रहा है',
  },
  AOS_I_PROGRESS: {
    en: 'PROGRESS', tr: 'İLERLEME', de: 'FORTSCHRITT', fr: 'PROGRESSION',
    es: 'PROGRESO', pt: 'PROGRESSO', it: 'AVANZAMENTO', ru: 'ПРОГРЕСС',
    zh: '进度', ja: '進行状況', ar: 'التقدّم', hi: 'प्रगति',
  },
  AOS_I_LOG: {
    en: 'INSTALLATION LOG', tr: 'KURULUM GÜNLÜĞÜ', de: 'INSTALLATIONSPROTOKOLL',
    fr: 'JOURNAL D\'INSTALLATION', es: 'REGISTRO DE INSTALACIÓN', pt: 'REGISTRO DE INSTALAÇÃO',
    it: 'REGISTRO DI INSTALLAZIONE', ru: 'ЖУРНАЛ УСТАНОВКИ', zh: '安装日志',
    ja: 'インストールログ', ar: 'سجل التثبيت', hi: 'इंस्टॉलेशन लॉग',
  },

  // ---- finish page ----
  AOS_F_TITLE: {
    en: 'Installation Complete', tr: 'Kurulum tamamlandı', de: 'Installation abgeschlossen',
    fr: 'Installation terminée', es: 'Instalación completada', pt: 'Instalação concluída',
    it: 'Installazione completata', ru: 'Установка завершена', zh: '安装完成',
    ja: 'インストールが完了しました', ar: 'اكتمل التثبيت', hi: 'इंस्टॉलेशन पूर्ण',
  },
  AOS_F_BODY: {
    en: 'AnyOSStack has been successfully installed and configured on your system.',
    tr: 'AnyOSStack sisteminize başarıyla kuruldu ve yapılandırıldı.',
    de: 'AnyOSStack wurde erfolgreich auf Ihrem System installiert und eingerichtet.',
    fr: 'AnyOSStack a été installé et configuré avec succès sur votre système.',
    es: 'AnyOSStack se ha instalado y configurado correctamente en tu sistema.',
    pt: 'O AnyOSStack foi instalado e configurado com sucesso no seu sistema.',
    it: 'AnyOSStack è stato installato e configurato correttamente sul tuo sistema.',
    ru: 'AnyOSStack успешно установлен и настроен в вашей системе.',
    zh: 'AnyOSStack 已成功安装并完成配置。',
    ja: 'AnyOSStack のインストールと設定が完了しました。',
    ar: 'تم تثبيت AnyOSStack وتهيئته بنجاح على نظامك.',
    hi: 'AnyOSStack आपके सिस्टम पर सफलतापूर्वक इंस्टॉल और कॉन्फ़िगर हो गया है।',
  },
  AOS_F_ACTION: {
    en: 'POST-INSTALL ACTION', tr: 'KURULUM SONRASI', de: 'NACH DER INSTALLATION',
    fr: 'APRÈS INSTALLATION', es: 'DESPUÉS DE INSTALAR', pt: 'APÓS A INSTALAÇÃO',
    it: 'DOPO L\'INSTALLAZIONE', ru: 'ПОСЛЕ УСТАНОВКИ', zh: '安装后操作',
    ja: 'インストール後の操作', ar: 'إجراء ما بعد التثبيت', hi: 'इंस्टॉल के बाद',
  },
  AOS_LAUNCH: {
    en: 'Launch AnyOSStack now', tr: "AnyOSStack'i şimdi başlat",
    de: 'AnyOSStack jetzt starten', fr: 'Lancer AnyOSStack maintenant',
    es: 'Iniciar AnyOSStack ahora', pt: 'Iniciar o AnyOSStack agora',
    it: 'Avvia AnyOSStack ora', ru: 'Запустить AnyOSStack сейчас',
    zh: '立即启动 AnyOSStack', ja: 'AnyOSStack を今すぐ起動',
    ar: 'تشغيل AnyOSStack الآن', hi: 'AnyOSStack अभी लॉन्च करें',
  },

  // ---- install section progress lines ----
  AOS_STEP_PREPARE: {
    en: 'Preparing AnyOSStack...', tr: 'AnyOSStack hazırlanıyor...',
    de: 'AnyOSStack wird vorbereitet...', fr: 'Préparation d\'AnyOSStack...',
    es: 'Preparando AnyOSStack...', pt: 'Preparando o AnyOSStack...',
    it: 'Preparazione di AnyOSStack...', ru: 'Подготовка AnyOSStack...',
    zh: '正在准备 AnyOSStack...', ja: 'AnyOSStack を準備しています...',
    ar: 'جارٍ تحضير AnyOSStack...', hi: 'AnyOSStack तैयार हो रहा है...',
  },
  AOS_STEP_SHORTCUTS: {
    en: 'Creating shortcuts...', tr: 'Kısayollar oluşturuluyor...',
    de: 'Verknüpfungen werden erstellt...', fr: 'Création des raccourcis...',
    es: 'Creando accesos directos...', pt: 'Criando atalhos...',
    it: 'Creazione dei collegamenti...', ru: 'Создание ярлыков...',
    zh: '正在创建快捷方式...', ja: 'ショートカットを作成しています...',
    ar: 'جارٍ إنشاء الاختصارات...', hi: 'शॉर्टकट बनाए जा रहे हैं...',
  },
  AOS_STEP_REGISTER: {
    en: 'Registering the uninstaller...', tr: 'Kaldırma aracı kaydediliyor...',
    de: 'Deinstallationsprogramm wird registriert...',
    fr: 'Enregistrement du programme de désinstallation...',
    es: 'Registrando el desinstalador...', pt: 'Registrando o desinstalador...',
    it: 'Registrazione del programma di disinstallazione...',
    ru: 'Регистрация деинсталлятора...', zh: '正在注册卸载程序...',
    ja: 'アンインストーラーを登録しています...',
    ar: 'جارٍ تسجيل أداة إلغاء التثبيت...', hi: 'अनइंस्टॉलर पंजीकृत हो रहा है...',
  },
  AOS_STEP_DONE: {
    en: 'AnyOSStack installation complete.', tr: 'AnyOSStack kurulumu tamamlandı.',
    de: 'Installation von AnyOSStack abgeschlossen.',
    fr: 'Installation d\'AnyOSStack terminée.',
    es: 'Instalación de AnyOSStack completada.', pt: 'Instalação do AnyOSStack concluída.',
    it: 'Installazione di AnyOSStack completata.', ru: 'Установка AnyOSStack завершена.',
    zh: 'AnyOSStack 安装完成。', ja: 'AnyOSStack のインストールが完了しました。',
    ar: 'اكتمل تثبيت AnyOSStack.', hi: 'AnyOSStack इंस्टॉलेशन पूरा हुआ।',
  },

  // ---- installer branding tagline (also used by the electron-builder path) ----
  AOS_TAGLINE: {
    en: 'Pick your apps, get one install script for every OS.',
    tr: 'Uygulamalarını seç, her OS için tek kurulum betiği al.',
    de: 'Apps auswählen, ein Installationsskript für jedes OS.',
    fr: 'Choisissez vos applis, un script d\'installation pour chaque OS.',
    es: 'Elige tus apps y obtén un script de instalación para cada OS.',
    pt: 'Escolha seus apps e receba um script de instalação para cada OS.',
    it: 'Scegli le tue app, ottieni uno script di installazione per ogni OS.',
    ru: 'Выберите приложения — один скрипт установки для любой ОС.',
    zh: '选择你的应用，为每个操作系统生成一个安装脚本。',
    ja: 'アプリを選ぶだけで、各OS向けのインストールスクリプトを生成。',
    ar: 'اختر تطبيقاتك واحصل على سكربت تثبيت واحد لكل نظام.',
    hi: 'अपने ऐप्स चुनें, हर OS के लिए एक इंस्टॉल स्क्रिप्ट पाएं।',
  },
};

// NSIS string escaping: $ starts an escape, " ends the string.
function esc(s) {
  return s.replace(/\$/g, '$$$$').replace(/"/g, '$\\"');
}

function assertComplete() {
  const ids = LANGS.map(([id]) => id);
  const missing = [];
  for (const [key, table] of Object.entries(STRINGS)) {
    for (const id of ids) {
      if (typeof table[id] !== 'string' || table[id] === '') missing.push(`${key}.${id}`);
    }
  }
  if (missing.length) {
    throw new Error(`Missing translations: ${missing.join(', ')}`);
  }
}

// build/anyosstack-languages.nsh - the standalone wizard's full language pack.
function languagesNsh() {
  const out = [];
  out.push('; anyosstack-languages.nsh - GENERATED by scripts/build-installer-lang.js.');
  out.push('; Do not edit by hand; edit the STRINGS table in that script instead.');
  out.push('; Every visible wizard string lives here, so selecting a language in the');
  out.push('; startup picker translates the whole installer, not just the buttons.');
  out.push('');
  for (const [, , nlf] of LANGS) {
    out.push(`LoadLanguageFile "\${NSISDIR}\\Contrib\\Language files\\${nlf}.nlf"`);
  }
  out.push('');
  out.push('; Native language names for the startup picker.');
  for (const [id, macro] of LANGS) {
    out.push(`!define AOS_LANGNAME_${macro} "${esc(ENDONYMS[id])}"`);
  }
  out.push('');
  // Helpers for the branded language page (build/anyosstack-setup.nsi): fill the
  // combo, preselect the active language, and map a selection back to a LANG id.
  out.push(`!define AOS_LANG_COUNT ${LANGS.length}`);
  out.push('');
  // The picker is built from our own labels, not a combo box: a combo's drop-down
  // is a separate top-level window, so the wizard's dialog never receives its
  // WM_CTLCOLOR* messages - the list stayed white with a system-blue selection
  // bar no matter what was applied to the combo itself.
  // Two columns of six, laid out here so the .nsi needs no compile-time maths.
  // Each row keeps its own variable: deriving row handles from control ids by
  // arithmetic hid whatever else happened to sit at those ids and wiped the page.
  const BASE_X = 452, COL_W = 228, BASE_Y = 378, ROW_H = 26, PER_COL = 6;
  out.push('!macro AOS_LANG_VARS');
  LANGS.forEach((_, i) => out.push(`  Var LangRow${i}`));
  out.push('!macroend');
  out.push('');
  // List box messages. 0x180 = LB_ADDSTRING, 0x186 = LB_SETCURSEL.
  out.push('!macro AOS_LANG_FILL LIST');
  for (const [id] of LANGS) {
    out.push(`  SendMessage \${LIST} 0x180 0 "STR:${esc(ENDONYMS[id])}"`);
  }
  out.push('!macroend');
  out.push('');
  out.push('!macro AOS_LANG_PRESELECT LIST');
  LANGS.forEach(([, macro], i) => {
    out.push(`  \${If} $LANGUAGE == \${LANG_${macro}}`);
    out.push(`    SendMessage \${LIST} 0x186 ${i} 0`);
    out.push('  ${EndIf}');
  });
  out.push('!macroend');
  out.push('');
  out.push('!macro AOS_LANG_ROWS');
  LANGS.forEach(([id], i) => {
    const x = BASE_X + Math.floor(i / PER_COL) * COL_W;
    const y = BASE_Y + (i % PER_COL) * ROW_H;
    out.push(`  !insertmacro AOS_LANG_ROW ${x} ${y} "${esc(ENDONYMS[id])}"`);
    out.push(`  StrCpy $LangRow${i} $R9`);
  });
  out.push('!macroend');
  out.push('');
  out.push('; Show or hide the whole panel. STATE is ${SW_SHOW} or ${SW_HIDE}.');
  out.push('!macro AOS_LANG_SHOW STATE');
  LANGS.forEach((_, i) => out.push(`  ShowWindow $LangRow${i} \${STATE}`));
  out.push('!macroend');
  out.push('');
  out.push('; Repaint rows so the selected one carries the brand colour.');
  out.push('!macro AOS_LANG_PAINT');
  LANGS.forEach((_, i) => {
    out.push(`  \${If} $LangSel == ${i}`);
    out.push(`    SetCtlColors $LangRow${i} \${COLOR_BLACK} \${COLOR_ORANGE}`);
    out.push('  ${Else}');
    out.push(`    SetCtlColors $LangRow${i} \${COLOR_INK} \${COLOR_SURFACE}`);
    out.push('  ${EndIf}');
    out.push(`  System::Call 'user32::InvalidateRect(p $LangRow${i}, p 0, i 1)'`);
  });
  out.push('!macroend');
  out.push('');
  out.push('; Clicked handle -> row index.');
  out.push('!macro AOS_LANG_FROM_HWND VAR');
  LANGS.forEach((_, i) => {
    out.push(`  \${If} \${VAR} == $LangRow${i}`);
    out.push(`    StrCpy $LangSel ${i}`);
    out.push('  ${EndIf}');
  });
  out.push('!macroend');
  out.push('');
  out.push('; Current $LANGUAGE -> row index.');
  out.push('!macro AOS_LANG_INDEX');
  LANGS.forEach(([, macro], i) => {
    out.push(`  \${If} $LANGUAGE == \${LANG_${macro}}`);
    out.push(`    StrCpy $LangSel ${i}`);
    out.push('  ${EndIf}');
  });
  out.push('!macroend');
  out.push('');
  out.push('; Row index -> the name shown on the closed bar.');
  out.push('!macro AOS_LANG_NAME IDX VAR');
  LANGS.forEach(([id], i) => {
    out.push(`  \${If} \${IDX} == ${i}`);
    out.push(`    StrCpy \${VAR} "${esc(ENDONYMS[id])}"`);
    out.push('  ${EndIf}');
  });
  out.push('!macroend');
  out.push('');
  out.push('!macro AOS_LANG_APPLY IDX');
  LANGS.forEach(([, macro], i) => {
    out.push(`  \${If} \${IDX} == ${i}`);
    out.push(`    StrCpy $LANGUAGE \${LANG_${macro}}`);
    out.push('  ${EndIf}');
  });
  out.push('!macroend');
  out.push('');
  for (const [key, table] of Object.entries(STRINGS)) {
    for (const [id, macro] of LANGS) {
      out.push(`LangString ${key} \${LANG_${macro}} "${esc(table[id])}"`);
    }
    out.push('');
  }
  return out.join('\n');
}

// build/installer.nsh - the electron-builder NSIS include (standard wizard).
function installerNsh() {
  const lines = [];
  lines.push('; installer.nsh - GENERATED by scripts/build-installer-lang.js. Do not edit by hand.');
  lines.push('; Adds the localized AnyOSStack branding tagline to the NSIS installer.');
  lines.push('; electron-builder localizes the standard wizard pages on its own; this only');
  lines.push('; supplies the one brand string those translations do not include.');
  lines.push('');
  lines.push('!macro customHeader');
  for (const [id, macro] of LANGS) {
    lines.push(`  LangString AOS_TAGLINE $\{LANG_${macro}} "${esc(STRINGS.AOS_TAGLINE[id])}"`);
  }
  lines.push('!macroend');
  lines.push('');
  lines.push('!macro customInit');
  lines.push('  ; Show the localized tagline along the bottom of the wizard.');
  lines.push('  BrandingText "$(AOS_TAGLINE)"');
  lines.push('!macroend');
  lines.push('');
  lines.push('!macro customInstall');
  lines.push('  ; (reserved) place any post-copy registry keys / file associations here.');
  lines.push('!macroend');
  lines.push('');
  return lines.join('\n');
}

function desktopYml() {
  const out = ['# GENERATED by scripts/build-installer-lang.js - paste under linux.desktop in electron-builder.yml',
    '# (Name/Comment localizations; the base Name/Comment stay in the yml itself.)'];
  for (const [id] of LANGS) {
    if (id === 'en') continue; // base value already in the yml
    out.push(`Name[${id}]: AnyOSStack`);
    out.push(`Comment[${id}]: ${STRINGS.AOS_TAGLINE[id]}`);
  }
  return out.join('\n') + '\n';
}

assertComplete();
fs.mkdirSync(BUILD, { recursive: true });
fs.writeFileSync(path.join(BUILD, 'anyosstack-languages.nsh'), languagesNsh(), 'utf8');
fs.writeFileSync(path.join(BUILD, 'installer.nsh'), installerNsh(), 'utf8');
fs.writeFileSync(path.join(BUILD, 'linux-desktop.yml'), desktopYml(), 'utf8');
console.log(
  `Wrote build/anyosstack-languages.nsh (${Object.keys(STRINGS).length} strings x ${LANGS.length} languages), ` +
  'build/installer.nsh and build/linux-desktop.yml.',
);
