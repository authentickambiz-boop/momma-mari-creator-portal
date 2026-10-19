const GROUPS = [
  ["parenting", "toddler mom", "newborn", "boy mom", "girl mom", "twin mom", "homeschool", "gentle parenting", "working mom", "stay at home mom", "single mom", "adoptive mom", "foster mom", "pregnancy", "postpartum", "baby led weaning", "picky eaters", "kids activities", "family travel", "roadschool"],
  ["food", "easy dinners", "meal prep", "baking", "sourdough", "air fryer", "slow cooker", "budget meals", "high protein", "gluten free", "dairy free", "vegan", "vegetarian", "kid friendly meals", "lunchboxes", "coffee", "mocktails", "grilling", "southern cooking", "mexican cooking"],
  ["home", "cleaning", "organization", "declutter", "small spaces", "apartment living", "home decor", "thrift flips", "diy", "paint projects", "rental friendly", "laundry", "pantry", "mudroom", "nursery", "backyard", "gardening", "houseplants", "seasonal decor", "amazon home"],
  ["beauty", "skincare", "makeup", "clean beauty", "curly hair", "hair tutorials", "natural hair", "nails", "fragrance", "sunscreen", "mature skin", "acne", "brows", "everyday glam", "drugstore makeup", "clean fragrance"],
  ["wellness", "mental health", "anxiety", "postpartum wellness", "fitness", "home workouts", "walking", "running", "yoga", "pilates", "strength training", "pelvic floor", "nutrition", "sleep", "hormones", "cycle syncing", "sober curious", "meditation"],
  ["fashion", "mom style", "midsize fashion", "plus size fashion", "petite fashion", "capsule wardrobe", "thrift fashion", "workwear", "affordable fashion", "shoes", "seasonal outfits", "modest fashion"],
  ["lifestyle", "day in the life", "morning routine", "night routine", "productivity", "journal", "faith", "christian mom", "slow living", "coastal", "southern lifestyle", "midwest mom", "city mom", "rural life"],
  ["education", "teacher", "preschool", "kindergarten", "reading", "learning activities", "special education", "speech therapy", "occupational therapy", "school mornings", "homework"],
  ["baby gear", "strollers", "car seats", "baby wearing", "breastfeeding", "formula feeding", "pumping", "cloth diapers", "sleep training", "baby registry"],
  ["pets", "dog mom", "cat mom", "rescue dogs", "puppy", "pet training", "goldendoodle", "french bulldog"],
  ["outdoors", "hiking", "camping", "beach", "national parks", "fishing", "hunting family", "van life", "rv"],
  ["tech", "amazon finds", "tiktok made me buy it", "app reviews", "smart home", "phone tips", "creator tips"],
  ["money", "budgeting", "couponing", "debt free", "side hustle", "saving money", "grocery savings"],
  ["crafts", "cricut", "sewing", "knitting", "crochet", "scrapbook", "party planning", "kids crafts"],
  ["holidays", "christmas", "halloween", "easter", "thanksgiving", "birthday parties", "gift guides"],
  ["health", "allergies", "eczema", "asthma", "adhd mom", "autism mom", "sensory", "picky eating therapy", "pediatric"],
  ["relationships", "marriage", "date night", "friendship", "grandparents", "blended family", "military spouse"],
  ["career", "wfh mom", "nurse mom", "teacher mom", "small business", "etsy seller", "ugc creator", "amazon influencer"],
  ["entertainment", "booktok", "romance books", "true crime", "reality tv", "disney", "theme parks", "movies with kids"],
  ["sports", "youth sports", "soccer mom", "dance mom", "cheer", "softball", "gymnastics", "swim"],
  ["culture", "latina mom", "black mom", "asian mom", "bilingual", "spanish content", "immigrant mom", "southern black mom"],
  ["green", "low tox", "plastic free", "cloth alternatives", "nontoxic home", "clean swaps"],
  ["auto", "minivan", "car organization", "road trips", "car seats installed"],
  ["photo", "iphone photos", "family photos", "reels tips", "storytelling", "voiceover"],
];

const EXTRA = [
  "grwm", "get ready with me", "target finds", "walmart finds", "aldi finds", "costco", "sam's club", "trader joe's",
  "nursery tours", "toy reviews", "screen time", "montessori", "waldorf", "charlotte mason", "unschool",
  "potty training", "toddler tantrums", "sibling rivalry", "new sibling", "micropigmentation", "lashes",
  "self tanner", "body care", "oral care", "vitamins", "prenatal", "menopause", "perimenopause",
  "weight loss", "postpartum fitness", "diastasis", "running with a stroller", "peloton",
  "instant pot", "sheet pan", "freezer meals", "smoothie", "packed lunches", "after school snacks",
  "laundry detergent", "cleaning hacks", "fridge organization", "spice drawer", "command hooks",
  "ikea hacks", "facebook marketplace", "estate sale", "antique", "vintage",
  "capsule for kids", "kids fashion", "hand me downs", "uniform", "back to school",
  "teacher gifts", "classroom", "sub plans", "homeschool co-op", "curriculum",
  "disney world", "universal", "cruise with kids", "beach trip", "ski trip", "cabin",
  "allergy friendly", "nut free", "celiac", "pcos", "thyroid", "migraine",
  "dog training", "reactive dog", "cat enrichment", "aquarium",
  "faith journaling", "bible study", "church mom", "sabbath",
  "minimalism", "hot mess mom", "realistic mom", "honest mom", "overstimulated mom",
];

export const NICHE_CATALOG: readonly string[] = [...new Set([...GROUPS.flat(), ...EXTRA])].sort((a, b) => a.localeCompare(b));

export const FORMAT_OPTIONS = ["TikTok", "Reels", "Stories", "YouTube", "Photo", "Blog", "UGC", "Live"] as const;
export const PLATFORM_OPTIONS = ["TikTok", "Instagram", "Facebook", "YouTube", "Pinterest"] as const;
export const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Portuguese", "Mandarin", "Korean", "Arabic", "Hindi", "ASL"] as const;
export const LOCATION_OPTIONS = [
  "United States", "California", "Texas", "Florida", "New York", "North Carolina", "Georgia", "Ohio", "Illinois", "Pennsylvania",
  "Michigan", "New Jersey", "Virginia", "Washington", "Arizona", "Tennessee", "Massachusetts", "Colorado", "Canada", "United Kingdom", "Mexico",
] as const;

export const BRAND_OPTIONS = [
  "Amazon", "Target", "Walmart", "Costco", "Aldi", "Trader Joe's", "VEV", "WaterH", "Nike", "Adidas", "Lululemon",
  "Gap", "Old Navy", "Carter's", "Primary", "Hatch", "Frida", "Owlet", "BabyBjorn", "Uppababy", "Coterie", "Honest",
  "Hello Bello", "Pampers", "Huggies", "Gerber", "Happy Baby", "Serenity Kids", "Once Upon a Farm", "Little Spoon",
] as const;
