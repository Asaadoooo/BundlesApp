import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { BundleStatus } from "~/types/bundle";

// POST /api/bundles/:id/schedule - Schedule bundle activation
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!id) {
    return Response.json({ error: "Bundle ID is required" }, { status: 400 });
  }

  try {
    // Verify bundle belongs to shop
    const existingBundle = await prisma.bundle.findFirst({
      where: { id, shop },
    });

    if (!existingBundle) {
      return Response.json({ error: "Bundle not found" }, { status: 404 });
    }

    const body = await request.json();
    const { startDate, endDate, activateNow = false } = body;

    // Validate dates
    if (!activateNow && !startDate) {
      return Response.json(
        { error: "Either startDate or activateNow is required" },
        { status: 400 }
      );
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
      return Response.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Determine new status
    let newStatus = existingBundle.status;

    if (activateNow) {
      newStatus = BundleStatus.ACTIVE;
    } else if (parsedStartDate && parsedStartDate > new Date()) {
      newStatus = BundleStatus.SCHEDULED;
    } else {
      newStatus = BundleStatus.ACTIVE;
    }

    // Update bundle schedule
    const updatedBundle = await prisma.bundle.update({
      where: { id },
      data: {
        startDate: activateNow ? new Date() : parsedStartDate,
        endDate: parsedEndDate,
        status: newStatus,
      },
      include: {
        items: { orderBy: { position: "asc" } },
        tiers: { orderBy: { position: "asc" } },
        volumeRules: { orderBy: { position: "asc" } },
        categories: {
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
      },
    });

    return Response.json({
      data: updatedBundle,
      message: activateNow
        ? "Bundle activated"
        : `Bundle scheduled for ${parsedStartDate?.toISOString()}`,
    });
  } catch (error) {
    console.error("Error scheduling bundle:", error);
    return Response.json(
      { error: "Failed to schedule bundle", details: String(error) },
      { status: 500 }
    );
  }
};
