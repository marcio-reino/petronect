const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Garantir que os diretórios existam
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configuração de storage para avatares de usuários
const userAvatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/users');
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const userId = req.user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `user-${userId}-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para empresas
const companyStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/companies');
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const companyId = req.params.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `company-${companyId}-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para treinamentos
const trainingStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/trainings');
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const trainingId = req.params.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `training-${trainingId}-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para imagem de cursos
const courseImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const courseId = req.params.id || 'unknown';
    const uploadPath = path.join(__dirname, `../../uploads/courses/${courseId}`);
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const courseId = req.params.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `course-${courseId}-image-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para logos do website
const websiteLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/website');
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const type = req.body.type || 'logo';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `website-${type}-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para anexos de aulas
const lessonAttachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const courseId = req.params.id || 'unknown';
    const lessonId = req.params.lessonId || 'unknown';
    const uploadPath = path.join(__dirname, `../../uploads/courses/${courseId}/lessons/${lessonId}`);
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // Preservar nome original sem caracteres especiais
    const originalName = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${originalName}-${uniqueSuffix}${ext}`);
  }
});

// Configuração de storage para imagens de questões de questionário
const quizQuestionImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const courseId = req.params.id || 'unknown';
    const quizId = req.params.quizId || 'unknown';
    const uploadPath = path.join(__dirname, `../../uploads/courses/${courseId}/quizzes/${quizId}`);
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `question-${uniqueSuffix}${ext}`);
  }
});

// Filtro de tipos de arquivo para imagens
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas imagens (JPEG, PNG, GIF, WebP, SVG) são aceitas.'), false);
  }
};

// Filtro de tipos de arquivo para documentos
const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas documentos (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX) são aceitos.'), false);
  }
};

// Filtro de tipos de arquivo para imagem de curso (PNG e JPG)
const courseImageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas imagens PNG e JPG são aceitas.'), false);
  }
};

// Filtro de tipos de arquivo para anexos de aulas (PDF, imagens, documentos, ZIP)
const lessonAttachmentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas PDF, JPG, PNG, Word, Excel e ZIP são aceitos.'), false);
  }
};

// Upload de avatar de usuário
const uploadUserAvatar = multer({
  storage: userAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
}).single('avatar');

// Upload de logo de empresa
const uploadCompanyLogo = multer({
  storage: companyStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
}).single('logo');

// Upload de capa de proposta de empresa
const uploadCompanyCover = multer({
  storage: companyStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFileFilter
}).single('cover');

// Upload de documentos de treinamento
const uploadTrainingDocument = multer({
  storage: trainingStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: documentFileFilter
}).single('document');

// Upload de arquivo de apresentação de empresa
const uploadCompanyPresentation = multer({
  storage: companyStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: documentFileFilter
}).single('presentation');

// Upload de imagem do curso (PNG, max 1MB)
const uploadCourseImage = multer({
  storage: courseImageStorage,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB
  },
  fileFilter: courseImageFileFilter
}).single('image');

// Upload de anexo de aula (único arquivo)
const uploadLessonAttachment = multer({
  storage: lessonAttachmentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: lessonAttachmentFileFilter
}).single('attachment');

// Upload de múltiplos anexos de aula
const uploadLessonAttachments = multer({
  storage: lessonAttachmentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB por arquivo
  },
  fileFilter: lessonAttachmentFileFilter
}).array('attachments', 10); // Máximo 10 arquivos

// Upload de logo do website (PNG, JPG, SVG, max 2MB)
const uploadWebsiteLogo = multer({
  storage: websiteLogoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: imageFileFilter
}).single('logo');

// Configuração de storage para logos de clientes do website
const clientLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/website/clients');
    ensureDirExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `client-${uniqueSuffix}${ext}`);
  }
});

// Upload de logo de cliente do website (PNG, JPG, SVG, max 2MB)
const uploadClientLogo = multer({
  storage: clientLogoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: imageFileFilter
}).single('logo');

// Upload de imagem de questão de questionário (PNG, JPG, max 2MB)
const uploadQuizQuestionImage = multer({
  storage: quizQuestionImageStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: courseImageFileFilter
}).single('image');

// Middleware para deletar arquivo antigo
const deleteOldFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log('Arquivo antigo deletado:', filePath);
    } catch (error) {
      console.error('Erro ao deletar arquivo antigo:', error);
    }
  }
};

module.exports = {
  uploadUserAvatar,
  uploadCompanyLogo,
  uploadCompanyCover,
  uploadCompanyPresentation,
  uploadTrainingDocument,
  uploadCourseImage,
  uploadLessonAttachment,
  uploadLessonAttachments,
  uploadWebsiteLogo,
  uploadClientLogo,
  uploadQuizQuestionImage,
  deleteOldFile,
  ensureDirExists
};
