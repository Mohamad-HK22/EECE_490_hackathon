#  Stories Coffee – Profit Optimization Analysis
Machine Learning & Business Intelligence Hackathon

##  Business Problem

Stories Coffee provided one full year of operational sales data (2025 + January 2026) and asked a simple but critical question:

> "I have all this data… tell me how to make more money."

Our objective was to identify:
- Which products and categories drive the majority of profit
- Which items contribute weak margins or losses
- Where profit leakage exists
- What actionable steps can increase overall profitability

This is not a theoretical ML project — this is a real consulting analysis focused on profit improvement.

---

##  Approach & Methodology

We tackled the problem in four structured phases:

###  Data Cleaning & Preparation
- Removed repeated POS headers
- Standardized branch names 
- Handled formatting inconsistencies
- Derived true revenue where needed using:


###  Exploratory Data Analysis (EDA)
We analyzed:

- Profit distributions (histograms & boxplots)
- Cost vs Profit relationships (scatter plots)
- Monthly sales trends by branch
- Category and product-level performance
- Profit margin behavior

This helped us detect:
- Profit concentration patterns
- Star performers
- Loss-making items
- Seasonal sales variation

###  Business-Focused Analysis
Instead of focusing only on ML accuracy, we translated data patterns into business decisions:

- Identified high-margin, high-demand products
- Detected negative-margin items
- Compared branch-level performance
- Evaluated profit concentration behavior (Pareto-like effect)

###  Strategic Recommendations
Based on findings, we designed actionable profit-improvement strategies:
- Protect and scale star performers
- Fix profit leakage from loss-makers
- Menu engineering based on margin × demand
- Branch-level optimization insights

---

##  Key Insights

###  Profit is Highly Concentrated
A small portion of products generate a disproportionate share of total profit.

###  Loss-Making Items Exist
Several products show negative profit and reduce total profitability.

###  Higher Cost Often Means Higher Profit — But Not Always
While many high-cost items are profitable, some generate losses, signaling pricing or cost control issues.

### Sales Show Time Variation Across Months
Peak periods and lower periods suggest opportunities for demand-based promotion and inventory planning. Very low period during june.

---

##  Business Recommendations

1. Protect and prioritize top profit-driving products.
2. Audit and correct loss-making items (pricing, cost, bundling, or removal).
3. Use margin × demand segmentation for menu engineering.
4. Align product focus across branches based on top performers.

---

## 🚀 How to Run the Analysis
To run the Analysis you can either view the live dashboard in this live application:
https://eece-490-hackathon1.onrender.com/  (may take some seconds to load since deploy server was free)
(UI only for desktop not mobile)

(in case link doesnt work cd backend npm start. and cd frontend npm start)

the dashboard allows users to :

-Explore KPI summaries

-Analyze profit concentration

-Identify top profit performers

-Detect loss-making products

-View monthly and branch-level performance


or you can run the exploratory Data analysis found in the "MIN Requirements" folder. Run all cells to clean raw sales data , compute derived metrics, and generate distribution plots.


