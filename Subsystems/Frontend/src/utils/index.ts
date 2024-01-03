export const getDate = (hrs: number, min: number, sec: number, ms: number) => {
  const date = new Date();

  date.toLocaleDateString('es-ES');

  date.setUTCHours(hrs, min, sec, ms);

  return date.toISOString();
};

export const buildFeed = (
  author: String,
  title: String,
  description: String,
  link: String,
  journal: String
) => {
  return {
    author,
    title,
    description,
    link,
    journal,
  };
};
