"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { saveQuestionnaireStep, type QuestionnaireAnswers } from "@/lib/questionnaire";

function tags(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value));
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function saveQuestionnaireAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const step = String(formData.get("step") ?? "");
  const patch: Partial<QuestionnaireAnswers> = {};
  if (step === "niches") patch.niches = tags(formData, "niches");
  if (step === "platforms") {
    patch.platforms = tags(formData, "platforms");
    patch.handles = {
      TikTok: text(formData, "handleTikTok"),
      Instagram: text(formData, "handleInstagram"),
      Facebook: text(formData, "handleFacebook"),
      YouTube: text(formData, "handleYouTube"),
      Pinterest: text(formData, "handlePinterest"),
    };
  }
  if (step === "audience") {
    patch.audienceSize = text(formData, "audienceSize");
    patch.audienceAge = text(formData, "audienceAge");
    patch.genderSplit = text(formData, "genderSplit");
    patch.locations = tags(formData, "locations");
  }
  if (step === "formats") patch.formats = tags(formData, "formats");
  if (step === "frequency") patch.frequency = text(formData, "frequency");
  if (step === "rates") {
    patch.rates = {
      TikTok: text(formData, "rateTikTok"),
      Reel: text(formData, "rateReel"),
      Story: text(formData, "rateStory"),
      Photo: text(formData, "ratePhoto"),
    };
  }
  if (step === "brands") {
    patch.brands = tags(formData, "brands");
    patch.blocked = tags(formData, "blocked");
  }
  if (step === "kids") {
    patch.kidAges = tags(formData, "kidAges");
    patch.kidsConfirm = formData.get("kidsConfirm") === "1";
  }
  if (step === "camera") patch.onCamera = text(formData, "onCamera");
  if (step === "availability") {
    patch.availability = text(formData, "availability");
    patch.turnaround = text(formData, "turnaround");
  }
  if (step === "shipping") patch.shipping = text(formData, "shipping");
  if (step === "languages") patch.languages = tags(formData, "languages");
  const result = await saveQuestionnaireStep(db, viewer, {
    step,
    skip: formData.get("skip") === "1",
    pause: formData.get("pause") === "1",
    patch,
  });
  if (!result.ok) redirect(`/onboarding?step=${encodeURIComponent(step)}&questionError=${encodeURIComponent(result.error)}`);
  if (result.next === "home") redirect("/");
  if (result.next === "done") redirect("/onboarding?done=1");
  redirect(`/onboarding?step=${encodeURIComponent(result.next)}`);
}
