# Dashboard and Report Formula Reference

How every number on the dashboards and report tabs is computed. Dashboards are built in `src/modules/dashboard/dashboard.repository.ts` (response shapes in `src/contracts/dashboard/dashboard.dto.ts`); reports in `src/modules/reports/reports.repository.ts`. When this file and the code disagree, the code wins — fix this file.

Last verified against the code: 2026-10-05.

## Common Rules

- Percentage: `total > 0 ? round((part / total) * 100, 2) : 0`.
- Deleted leads, prospects and quotations are excluded (`deletedAt: null`); a prospect is also excluded when its lead is deleted. Exceptions are listed under [Known Inconsistencies](#known-inconsistencies).
- **Open lead**: status `NEW`, `ATTEMPTED_CONTACT` or `CONTACTED`.
- **Converted lead**: `lead.convertedAt` is not null. Conversion is not a status; a converted lead keeps its last status.
- **Customer / won**: prospect `stage = WON`.
- **Lost** (dashboards): `UNQUALIFIED` leads **plus** `LOST` prospects.
- **Revenue / sales value**: sum of quotation `grandTotal` where `status = APPROVED`. **Quotation value**: sum of `grandTotal` over all statuses.
- **Quotation owner**: `assignedToId`, else `createdById`.
- A follow-up is a `FollowUp` row. An **open** follow-up has `status = PENDING` on a prospect that is not deleted, whose lead is not deleted, and whose stage is not `WON`/`LOST`.
- Follow-up time windows use `dueAt` and business-day bounds in `APP_TIMEZONE` (`followUpDueWindows` in `followUp.repository.ts`):
  - Due today: `startOfToday <= dueAt < startOfTomorrow`.
  - Overdue: `dueAt < now - FOLLOW_UP_OVERDUE_GRACE_MINUTES` (5 minutes).
  - Not overdue: `dueAt >= now - 5 minutes`.
- A follow-up's **owner** is its `assignedToId`, or the prospect's `assignedToId` when that is null.
- **Trend charts** show the last 6 calendar months (including the current one) and the last 6 Monday-start weeks. Periods with no activity show as zero.
- Won/lost trend points are dated by the prospect's `updatedAt` — its last edit, used as a stand-in for when the stage changed.

## Super Admin Dashboard

`getSuperAdminStats` · `SuperAdminDashboardWidget.tsx` · cached for 90 seconds; cleared when an organization is created, changes status, or is archived or restored.

Platform-wide, counting only **live tenants** (organization `deletedAt` is null), so the numbers agree with the Organizations list.

| Metric | Field | Formula |
| --- | --- | --- |
| Total Users | `totalUsers` | Users that are not `SUPER_ADMIN` and not deleted, in live tenants |
| Total Items | `totalItems` | Items in live tenants |
| Total Leads | `totalLeads` | Leads in live tenants |
| Organizations | `totalOrganizations` | Live organizations |
| Total Prospects | `totalProspects` | Prospects in live tenants |
| Total Quotations | `totalQuotations` | Quotations in live tenants |
| Approved Revenue | `approvedQuotationRevenue` | Revenue across live tenants, rounded to 2 decimals |
| Organization Status | `organizationStatus` | `active` / `suspended` = live organizations by status; `total` = live organizations; `archived` = organizations with `deletedAt` set, reported separately because archiving also sets status to `SUSPENDED` |
| Lead Distribution | `organizationLeadDistribution` | Top 6 organizations by lead count; percentage = org leads / total leads. Organizations without leads are absent |
| Other Organizations | `otherOrganizations` | Organizations past the top 6, pooled into one count and percentage; `null` when there are none |
| Lead Trend | `leadTrend` | `totalLeads` per period by `leadDate`; `conversions` per period by `convertedAt`. Bucketed in SQL with `date_trunc` (UTC) |
| Recent Organizations | `recentOrganizations` | 5 newest live organizations, each with its user count (non-super-admin, not deleted) and lead count |

## Admin Dashboard

`getAdminDashboardData` · `AdminDashboardWidget.tsx` · scope: the admin's organization.

KPIs (`kpis`):

| Metric | Field | Formula |
| --- | --- | --- |
| Total Leads | `totalLeads` | Leads |
| New Leads Today | `newLeadsToday` | Leads with `leadDate` today (server-local day) |
| Open Leads | `openLeads` | Open leads |
| Prospects | `prospects` | Prospects |
| Quotations Sent | `quotationsSent` | Quotations, any status |
| Customers Won | `customersWon` | `WON` prospects |
| Lost Leads | `lostLeads` | `UNQUALIFIED` leads + `LOST` prospects |
| Conversion Rate | `conversionRate` | Prospects / total leads |
| Quotation Value | `quotationValue` | Quotation value (all statuses) |
| Sales Value Won | `salesValueWon` | Revenue (approved) |
| Follow-ups Due Today | `followUpsDueToday` | Open follow-ups due today |
| Overdue Follow-ups | `overdueFollowUps` | Open follow-ups in the overdue window |

Charts:

| Chart | Field | Formula |
| --- | --- | --- |
| Lead Source | `leadSourceWise` | Leads grouped by `source` (null shows as "Not Set"), sorted by count; percentage of total leads |
| Lead Status Funnel | `leadStatusFunnel` | **Unconverted** leads by each of the five statuses, plus a `Converted` bucket; the six buckets add up to total leads; percentage of total leads |
| Lead Trend | `leadTrend` | Per period: `totalLeads`, `newLeads` (now `NEW`), `openLeads` (now open), and `lostLeads` (now `UNQUALIFIED`), all dated by `leadDate`; plus `customersWon` and `LOST` prospects (added to `lostLeads`), dated by prospect `updatedAt` |
| Sales Trend | `salesTrend` | Per period by quotation `date`: `quotationValue` (all statuses) and `salesValue` (approved) |

Team tables (active managers and executives only, sorted by assigned leads):

| Table | Field | Formula |
| --- | --- | --- |
| Executive Performance | `executivePerformance` | Per executive: `assignedLeads`, `openLeads`, `prospects` (assigned to them), `customersWon` (their `WON` prospects), `quotationsSent` / `quotationValue` / `salesValue` (quotations they own), `conversionPercentage` = customers won / assigned leads |
| Manager Performance | `managerPerformance` | Same metrics per manager, counting records owned by the manager **or by any of their active executives** |

## Manager Dashboard

`getManagerStats` · `ManagerDashboardWidget.tsx`.

**Team** = the manager plus their active, non-deleted executives (`managerId` = the manager). "Team leads" are leads assigned to anyone on the team.

KPIs (`kpis`):

| Metric | Field | Formula |
| --- | --- | --- |
| Leads Assigned | `leadsAssigned` | Leads assigned to the manager personally |
| Leads Assigned to Team | `leadsAssignedToTeam` | Leads assigned to the manager's executives **by this manager** (`assignedById`) |
| Open Leads | `openLeads` | Open team leads |
| Prospects | `prospects` | Prospects assigned to the team, or whose lead is assigned to the team |
| Quotations Pending / Approved | `quotationsPending`, `quotationsApproved` | Quotations assigned to or created by the team, by status |
| Customers Converted | `customersConverted` | `WON` prospects whose lead this manager assigned to one of their executives |
| Team Conversion % | `teamConversionPercentage` | Customers converted / leads assigned to team |
| Follow-ups Due Today | `followUpsDueToday` | Team-owned follow-ups due today, **any status** (same number as the scheduled count below) |
| Overdue Follow-ups | `overdueFollowUps` | Open team-owned follow-ups in the overdue window |

Daily follow-up completion (`dailyFollowUpCompletion`), over team-owned follow-ups due today:

| Field | Formula |
| --- | --- |
| `scheduled` | Due today, any status |
| `completed` | Due today with status `COMPLETED` |
| `pending` | `scheduled - completed` (so it also counts missed, cancelled and rescheduled) |
| `overdue` | Open, due today, and already past the grace window |
| `completionPercentage` | Completed / scheduled |

Charts and tables:

| Chart | Field | Formula |
| --- | --- | --- |
| Lead Status Distribution | `leadStatusDistribution` | Team leads by status, converted leads included under their last status; `total` = all team leads |
| Lead Status Funnel | `leadStatusFunnel` | Unconverted team leads by status, plus `Converted`; percentage of all team leads |
| Lead Source | `leadSourceWise` | Team leads by `source`; percentage of all team leads |
| Executive Performance | `executivePerformance` | Top 6 executives by assigned leads: `assignedLeads`, `openLeads`, `prospects` and `customersConverted` (their prospects / `WON` prospects), `quotationsPending` / `quotationsApproved` (quotations they own), `conversionPercentage` = customers / assigned leads, `scheduledFollowUps` / `completedFollowUps` (**all-time** follow-ups they own, any status / `COMPLETED`), `followUpCompletionPercentage` |

## Executive Dashboard

`getExecutiveStats` · `ExecutiveDashboardWidget.tsx` · scope: records assigned to the executive (quotations: assigned to **or** created by them).

| Metric | Field | Formula |
| --- | --- | --- |
| My Leads | `myLeads` | Leads assigned to me |
| New Leads | `newLeads` | My unconverted leads with status `NEW` |
| Open Leads | `openLeads` | My unconverted open leads |
| Today's Follow-ups | `todaysFollowUps` | My open follow-ups due today |
| Overdue Follow-ups | `overdueFollowUps` | My open follow-ups in the overdue window |
| Prospects | `prospects` | Prospects assigned to me |
| Quotations Sent | `quotationsSent` | My quotations, any status |
| Customers Won | `customersWon` | My `WON` prospects |
| Lost Leads | `lostLeads` | My unconverted `UNQUALIFIED` leads + my `LOST` prospects |

| Chart | Field | Formula |
| --- | --- | --- |
| Lead Funnel | `leadFunnel` | The KPI counts above (My Leads, New, Open, Prospects, Quotations Sent, Customers Won, Lost — labelled "Unqualified Leads"), each as a percentage of my leads. A summary, not a strict funnel |
| Lead Status Funnel | `leadStatusFunnel` | My unconverted leads by status, plus `Converted`; percentage of my leads |
| Lead Source | `leadSourceWise` | My leads by `source`; percentage of my leads |
| Performance | `performance` | Per period: `leads` by `assignedAt` (else `leadDate`), `prospects` by `createdAt`, `quotationsSent` by `date`, `customersWon` and `LOST` prospects by prospect `updatedAt`, unconverted `UNQUALIFIED` leads by lead `updatedAt` (both added to `lostLeads`), `followUps` = my **open** follow-ups by `dueAt` |
| Upcoming Follow-ups | `upcomingFollowUps` | My next 6 open follow-ups that are not yet overdue, ordered by `dueAt` |

## Known Inconsistencies

These are how the code behaves today, recorded so nobody "fixes" the doc to match one screen and breaks agreement with another. Each is a candidate for a code fix.

- **"Follow-ups due today" means different things.** Admin and Executive count open (`PENDING`, non-terminal) follow-ups. Manager counts every status, so completed and cancelled ones are included.
- **Soft-deleted prospects are counted on the Manager and Executive dashboards.** Their prospect scopes filter on the lead's `deletedAt` but not the prospect's own, and deleting a prospect leaves its lead in place. Admin, Super Admin and all reports exclude them.
- **Super Admin `totalItems` includes soft-deleted items.** It filters only on the tenant being live.
- **Admin "New Leads Today" uses the server's local day**, which is UTC in production, not `APP_TIMEZONE`. The follow-up windows and reports use IST.
- **Admin conversion rate is prospects / leads**, while the team tables' conversion is customers won / assigned leads, and the Manager's is customers converted / leads assigned to team.
- **Won/lost trend dates are approximate.** They use the prospect's `updatedAt`, so editing a won prospect moves it to the current period.

## Reports - Shared Filters

Formula name: Report Date Range
Where used: All report tabs.
Files/components: `ReportsView.tsx`, `ReportFilters.tsx`, `reports.repository.ts -> getReportDateRange`.
Formula logic (all day bounds are IST, from `utils/business/dateUtils.ts`):
- Today = start and end of current day.
- This Week = Monday start through current day end.
- This Month = first day of current month through current day end.
- Custom = selected from/to dates.
- All Time = from the epoch through the end of today.
- The range is matched against a different date per record type: leads by `leadDate`, prospects by `createdAt`, quotations by `date`, follow-ups by `dueAt`.
Example: This Month on July 15 covers July 1 00:00 through July 15 23:59 IST.
Meaning: Limits report data to the selected period.

Formula name: Report Role Scope
Where used: All report tabs.
Files/components: `ReportsView.tsx`, `reports.repository.ts -> getRoleFilters`.
Formula logic:
- Executive sees own assigned/created activity.
- Manager sees self plus direct team, unless an executive filter is selected.
- Admin/Super Admin sees organization data, unless an executive filter is selected.
Example: Manager with 3 executives sees manager + 3 executives unless filtering one executive.
Meaning: Keeps reports aligned with the user's access level.

## Lead Reports

Formula name: Total Leads
Where used: Lead Reports summary card.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic: Count lead records matching report filters.
Example: 64 filtered lead records = 64 total leads.
Meaning: Shows how many leads match the current report filters.

Formula name: Converted Leads
Where used: Lead Reports summary card and Leads by Status chart.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic: Count leads where `convertedAt` is not null.
Example: 16 converted leads = 16 converted.
Meaning: Shows leads converted to prospects.

Formula name: Lead Converted to Prospect Rate
Where used: Lead Reports Converted card text.
Files/components: `LeadReports.tsx`.
Formula logic: `(converted leads / total leads) * 100`, displayed with 1 decimal place.
Example: 16 converted / 64 total * 100 = 25.0%.
Meaning: Shows the lead conversion percentage in the Lead Reports tab.

Formula name: Active Leads
Where used: Lead Reports summary card.
Files/components: `LeadReports.tsx`.
Formula logic: `total leads - converted leads - lost leads`.
Example: 64 total - 16 converted - 8 lost = 40 active leads.
Meaning: Shows leads still being worked.

Formula name: Lost Leads
Where used: Lead Reports summary card and Leads by Status chart.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic: Count non-converted leads where status is `UNQUALIFIED`.
Example: 8 unqualified leads = 8 lost leads.
Meaning: Shows leads that did not qualify.

Formula name: Leads by Status
Where used: Lead Reports pie chart.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic:
- New = status `NEW` and not converted.
- Contacted = status `CONTACTED` or `ATTEMPTED_CONTACT` and not converted.
- Qualified = status `QUALIFIED` and not converted.
- Lost = status `UNQUALIFIED` and not converted.
- Converted = `convertedAt` is not null.
Example: New 20, Contacted 12, Qualified 8, Lost 4, Converted 6.
Meaning: Shows filtered leads by status.

Formula name: Leads by Source
Where used: Lead Reports bar chart.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic:
- Website = source `WEBSITE`.
- Referral = source `REFERENCE`.
- Social Media = `SOCIAL_MEDIA`, `FACEBOOK`, `INSTAGRAM`, `LINKEDIN`.
- Campaign = `ADVERTISE`, `GOOGLE_ADS`, `EVENT`, `TRADE_SHOW`.
- Direct Inquiry = any other source.
Example: Website 10, Referral 6, Social Media 8, Campaign 4, Direct Inquiry 12.
Meaning: Shows where leads came from.

Formula name: Leads by Executive
Where used: Lead Reports executive table.
Files/components: `LeadReports.tsx`, `reports.repository.ts -> getLeadReports`.
Formula logic:
- Total Assigned = filtered leads assigned to that executive.
- Converted = assigned leads with `convertedAt` not null.
- Lost = assigned leads with status `UNQUALIFIED` and not converted.
- Active = total assigned - converted - lost.
Example: 20 assigned, 5 converted, 3 lost = 12 active.
Meaning: Shows lead workload and outcome by executive.

## Prospect Reports

Formula name: Total Prospects
Where used: Prospect Reports summary card.
Files/components: `ProspectReports.tsx`, `reports.repository.ts -> getProspectReports`.
Formula logic: Count prospects matching report filters and linked to active leads.
Example: 25 filtered prospects = 25 total prospects.
Meaning: Shows pipeline size for the selected report filter.

Formula name: Lead to Prospect Percentage
Where used: Prospect Reports summary card.
Files/components: `ProspectReports.tsx`, `reports.repository.ts -> getProspectReports`.
Formula logic: `(converted leads / total leads) * 100`.
Example: 20 converted leads / 80 total leads * 100 = 25%.
Meaning: Shows how many leads became prospects.

Formula name: Prospect to Customer Percentage
Where used: Prospect Reports summary card.
Files/components: `ProspectReports.tsx`, `reports.repository.ts -> getProspectReports`.
Formula logic: `(won prospects / total prospects) * 100`.
Example: 5 won prospects / 25 total prospects * 100 = 20%.
Meaning: Shows how many prospects became customers.

Formula name: Win Rate
Where used: Prospect Reports summary card as Prospect to Customer %, and dashboard won/customer summaries.
Files/components: `ProspectReports.tsx`, `ManagerDashboardWidget.tsx`, `ExecutiveDashboardWidget.tsx`, `reports.repository.ts -> getProspectReports`, `dashboard.repository.ts`.
Formula logic: `(won prospects / total prospects) * 100` when displayed as a rate. Dashboard cards usually show the won count directly.
Example: 8 won prospects / 40 total prospects * 100 = 20% win rate.
Meaning: Shows the percentage of prospects that became won customers.

Formula name: Sales Pipeline Stage Distribution
Where used: Prospect Reports horizontal bar chart.
Files/components: `ProspectReports.tsx`, `reports.repository.ts -> getProspectReports`.
Formula logic:
- Initial Discussion = stages `FOLLOW_UP` + `DEMO`.
- Requirement Gathering = stage `REQUIREMENT`.
- Proposal Sent = stage `PROPOSAL`.
- Negotiation = stage `NEGOTIATION`.
- Won = stage `WON`.
- Lost = stage `LOST`.
Example: Initial Discussion 9, Requirement 7, Proposal 5, Negotiation 3, Won 4, Lost 2.
Meaning: Shows where prospects are in the sales process.

Formula name: Expected Value
Where used: Prospect Records Details table.
Files/components: `ProspectReports.tsx`, `reports.repository.ts -> getProspectReports`.
Formula logic: Use prospect `expectedValue`, or 0 if empty.
Example: Prospect expected value 75000 = 75000 shown.
Meaning: Shows estimated deal value for a prospect.

## Quotation Reports

Formula name: Total Revenue Approved
Where used: Quotation Reports summary card.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic: Sum `grandTotal` of approved quotations matching filters.
Example: Approved totals 10000 + 15000 + 25000 = 50000.
Meaning: Shows realized revenue from approved quotations.

Formula name: Approved Quotations Value
Where used: Quotation Reports summary card.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic: Same as total approved revenue: sum `grandTotal` where status is `APPROVED`.
Example: Approved quotation values total 50000 = 50000.
Meaning: Shows total value of approved proposals.

Formula name: Pending Quotations Value
Where used: Quotation Reports summary card.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic: Sum `grandTotal` where quotation status is `PENDING`.
Example: Pending totals 12000 + 8000 = 20000.
Meaning: Shows possible revenue waiting for approval.

Formula name: Monthly Revenue Trend
Where used: Quotation Reports line chart.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic:
- Group quotations by month.
- Approved line = monthly sum of approved `grandTotal`.
- Pending line = monthly sum of pending `grandTotal`.
Example: July approved 50000 and pending 20000.
Meaning: Shows revenue and pending value over time.

Formula name: Quotations by Status
Where used: Quotation Reports bar chart.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic: Count quotations by `APPROVED`, `PENDING`, and `REJECTED`.
Example: Approved 12, Pending 7, Rejected 2.
Meaning: Shows quotation approval status split.

Formula name: Quotation Amounts
Where used: Quotation Records Details table.
Files/components: `QuotationReports.tsx`, `reports.repository.ts -> getQuotationReports`.
Formula logic:
- Subtotal = quotation `subtotal`.
- Tax Total = quotation `taxTotal`.
- Grand Total = quotation `grandTotal`.
Example: Subtotal 10000, tax 1800, grand total 11800.
Meaning: Shows quotation money fields saved on each quotation record.

## Performance Reports

Formula name: Lead Conversion Leaderboard
Where used: Performance Reports conversion bar chart and leaderboard table.
Files/components: `PerformanceReports.tsx`, `reports.repository.ts -> getPerformanceReports`.
Formula logic: `(converted assigned leads / assigned leads) * 100` per active executive/manager.
Example: 6 converted leads / 20 assigned leads * 100 = 30%.
Meaning: Compares lead conversion by team member.

Formula name: Follow-up Efficiency Scheduled vs Completed
Where used: Performance Reports follow-up bar chart.
Files/components: `PerformanceReports.tsx`, `reports.repository.ts -> getPerformanceReports`.
Formula logic:
- Scheduled Follow-ups = `FollowUp` rows whose `dueAt` is in the selected date range, owned by an active team member (`assignedToId`, else the prospect's `assignedToId`). The report's status filter narrows this to `COMPLETED` or `PENDING`.
- Completed Follow-ups = scheduled follow-ups where `status` is `COMPLETED`.
Example: 15 scheduled and 9 completed.
Meaning: Compares scheduled work with completed work.

Formula name: Pending Follow-ups
Where used: Performance Reports leaderboard table.
Files/components: `PerformanceReports.tsx`, `reports.repository.ts -> getPerformanceReports`.
Formula logic: `scheduled follow-ups - completed follow-ups`.
Example: 15 scheduled - 9 completed = 6 pending.
Meaning: Shows follow-ups still not completed.

Formula name: Follow-up Completion Percentage
Where used: Performance Reports leaderboard table.
Files/components: `PerformanceReports.tsx`, `reports.repository.ts -> getPerformanceReports`.
Formula logic: `(completed follow-ups / scheduled follow-ups) * 100`.
Example: 9 completed / 15 scheduled * 100 = 60%.
Meaning: Shows follow-up completion rate for each team member.
