import { z } from "zod";

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid birth date.").refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
  }, "Please enter a real birth date, not a future date."),
  city: z.string().trim().min(1, "Please enter your city.").max(120),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).max(20),
});