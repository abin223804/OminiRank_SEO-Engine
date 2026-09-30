import { prisma } from "@/lib/prisma";
import { scrapeCompetitorPage, CompetitorScrapeResult } from "./scraper";

/**
 * Scrapes a competitor page and persists the analysis to MongoDB Atlas
 */
export async function analyzeAndSaveCompetitor(
  projectId: string,
  scrapeUrl: string,
  targetKeyword?: string
): Promise<CompetitorScrapeResult> {
  const scrapeResult = await scrapeCompetitorPage(scrapeUrl, targetKeyword);

  // Check if competitor domain already exists for this project
  const existing = await prisma.competitor.findFirst({
    where: {
      projectId,
      domain: scrapeResult.domain,
    },
  });

  if (existing) {
    await prisma.competitor.update({
      where: { id: existing.id },
      data: {
        scrapeUrl: scrapeResult.scrapeUrl,
        lastScrapedAt: scrapeResult.scrapedAt,
        extractedKeywords: scrapeResult.extractedKeywords,
        contentTopics: scrapeResult.contentTopics,
      },
    });
  } else {
    await prisma.competitor.create({
      data: {
        projectId,
        domain: scrapeResult.domain,
        scrapeUrl: scrapeResult.scrapeUrl,
        lastScrapedAt: scrapeResult.scrapedAt,
        extractedKeywords: scrapeResult.extractedKeywords,
        contentTopics: scrapeResult.contentTopics,
      },
    });
  }

  return scrapeResult;
}

/**
 * Retrieves all registered competitors for a project
 */
export async function getProjectCompetitors(projectId: string) {
  return prisma.competitor.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Aggregates competitor topics and keywords to ground AI content generation
 */
export async function getCompetitorContextForGeneration(projectId: string): Promise<{
  topics: string[];
  keywords: string[];
  competitorDomains: string[];
}> {
  const competitors = await prisma.competitor.findMany({
    where: { projectId },
    take: 5,
  });

  const topics: string[] = [];
  const keywords: string[] = [];
  const competitorDomains: string[] = [];

  for (const comp of competitors) {
    competitorDomains.push(comp.domain);
    if (Array.isArray(comp.contentTopics)) {
      topics.push(...(comp.contentTopics as string[]));
    }
    if (Array.isArray(comp.extractedKeywords)) {
      keywords.push(...(comp.extractedKeywords as string[]));
    }
  }

  return {
    topics: Array.from(new Set(topics)).slice(0, 10),
    keywords: Array.from(new Set(keywords)).slice(0, 15),
    competitorDomains,
  };
}
