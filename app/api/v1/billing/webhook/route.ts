import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature, resolveTierFromPriceId } from "@/lib/billing/stripe";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
      }
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = event.type;
    const dataObject = event.data?.object;

    if (!eventType || !dataObject) {
      return NextResponse.json({ received: true });
    }

    // 1. Checkout completed
    if (eventType === "checkout.session.completed") {
      const customerId = dataObject.customer;
      const subscriptionId = dataObject.subscription;
      const workspaceId = dataObject.client_reference_id || dataObject.metadata?.workspaceId;

      if (workspaceId) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planTier: "PRO",
          },
        });
      }
    }

    // 2. Subscription updated
    if (eventType === "customer.subscription.updated") {
      const subscriptionId = dataObject.id;
      const priceId = dataObject.items?.data?.[0]?.price?.id;
      const newTier = resolveTierFromPriceId(priceId);

      const workspace = await prisma.workspace.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (workspace) {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { planTier: newTier },
        });
      }
    }

    // 3. Subscription deleted / canceled
    if (eventType === "customer.subscription.deleted") {
      const subscriptionId = dataObject.id;
      const workspace = await prisma.workspace.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (workspace) {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            planTier: "FREE",
            stripeSubscriptionId: null,
          },
        });
      }
    }

    return NextResponse.json({ received: true, eventType });
  } catch (error) {
    console.error("POST /api/v1/billing/webhook error:", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
