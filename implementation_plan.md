# Frontend 3-Screen Reorganization and Implementation

The goal is to provide a clean, distinct segmentation of the frontend into 3 different screens with premium designs, as well as a centralized launching point.

## User Review Required

> [!IMPORTANT]
> The current Next.js project has TailwindCSS configured and in use. I will continue leveraging Tailwind for the designs (with a very premium UI/UX focus including micro-animations, glassmorphism, and bold typography).
> 
> Also, to power the "Check Status" screen, I will add a small mock GET endpoint to `backend/main.py` to allow searching for an order by phone number or order ID. 

## Proposed Changes

---

### Backend Components

#### [MODIFY] [main.py](file:///d:/GoogleAPAC/prompt-wars/backend/main.py)
- **What will change:** Add a new GET endpoint `GET /api/status` that takes a query parameter `identifier`. This will iterate through `MOCK_ORDERS` and return the requested order's status and wait time, supporting the 3rd frontend screen.

---

### Frontend Components

#### [MODIFY] [page.tsx](file:///d:/GoogleAPAC/prompt-wars/frontend/src/app/page.tsx)
- **What will change:** This will become a beautiful "Launchpad" landing page with 3 major, dynamically animated navigation cards pointing to:
  1. Queue & Wait Time Display
  2. Place New Order
  3. Check Order Status

#### [NEW] [order/page.tsx](file:///d:/GoogleAPAC/prompt-wars/frontend/src/app/order/page.tsx)
- **What will change:** Will move the existing ordering logic from the homepage to here. This interface will be highly polished and premium, designed as a kiosk for users to place their orders.

#### [MODIFY] [display/page.tsx](file:///d:/GoogleAPAC/prompt-wars/frontend/src/app/display/page.tsx)
- **What will change:** Enhance the existing Big Screen display to explicitly show dynamic, simulated wait times for the orders in "In Kitchen Prep" to fulfill the user's specific request.

#### [NEW] [status/page.tsx](file:///d:/GoogleAPAC/prompt-wars/frontend/src/app/status/page.tsx)
- **What will change:** Create a completely new screen to check status. It will feature an input for either "Order ID" or "Mobile Number", fetch the status from the new backend endpoint, and render an aesthetically pleasing status card (e.g. "Wait Time: 12 min", "Status: IN KITCHEN").

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. I will boot both the backend Python server (`uvicorn`) and the frontend Next.js server (`npm run dev`) using the terminal.
2. We will place a mock order on the `/order` screen.
3. We will watch the `/display` screen to see the wait times update.
4. We will search for our newly placed order's phone number on the `/status` screen to verify the status returns successfully via the mocked backend endpoint.
