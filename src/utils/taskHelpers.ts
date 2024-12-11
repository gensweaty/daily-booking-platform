export const validateFile = (file: File | null): string | null => {
  if (!file) return null;
  
  if (file.size > 5 * 1024 * 1024) {
    return "File size exceeds 5MB limit.";
  }
  
  const allowedExtensions = ["jpg", "jpeg", "png", "pdf", "docx", "xlsx", "pptx"];
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (!fileExt || !allowedExtensions.includes(fileExt)) {
    return "Unsupported file type. Allowed: jpg, jpeg, png, pdf, docx, xlsx, pptx";
  }
  
  return null;
};

export const sanitizeDescription = (description: string | null): string => {
  if (!description) return "";
  return description.trim();
};