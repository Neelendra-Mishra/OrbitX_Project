# OrbitX — Autonomous Multi-Agent Travel Intelligence
### Comprehensive Technical Architecture, System Design & Operational Guide

---

## 1. Why I Built This Project (Motivation & Problem Statement)

### The Real-World Problem
Planning travel in the modern era is fragmented, exhausting, and prone to error:
- **Tab Overload & Disjointed Context:** Travelers consult dozens of disparate tabs: flight search engines, hotel booking portals, meteorological forecasts, travel blogs, currency converters, and budgeting spreadsheets.
- **Traditional Monolithic LLMs Fail for Travel:** When users prompt a standard chatbot (e.g., vanilla ChatGPT or Claude) to "plan a trip," the model:
  1. **Hallucinates Outdated or Fake Rates & Routes:** Monolithic models lack live API connectivity to airline reservation systems, hotel inventories, or local weather satellites.
  2. **Treats Multi-Variable Constraints Linearly:** Models struggle to balance budget ceilings, arrival/departure logistics, and weather-dependent activities simultaneously, causing budget overruns and illogical schedules.
  3. **Lacks Safety Boundaries:** Without domain-specific input guardrails, expensive LLM inference is wasted on off-topic questions, prompt injections, or malicious queries.
  4. **Operates as an Uncontrollable Black Box:** Traditional agents run from start to finish without pausing, generating rigid plans that cannot be reviewed, halted, or revised by the user before finalization.

### The Vision Behind OrbitX
I built **OrbitX** to demonstrate how to engineer a **production-ready, stateful, multi-agent AI system** that mirrors how a premier human travel agency operates:
- **A Supervisor / Orchestrator** assesses the request, enforces safety guardrails, and delegates tasks only to relevant specialists.
- **Specialized Domain Agents** (Flights, Hotels, Weather, Budget) query live external systems using the **Model Context Protocol (MCP)** rather than hallucinating facts.
- **Stateful Workflow with Checkpointing:** Built on **LangGraph**, the execution state is durably saved at every step using thread-specific checkpoints.
- **Human-in-the-Loop (HITL) Review:** Rather than blindly finalizing decisions, the system pauses execution at a draft checkpoint using LangGraph's native `interrupt()` mechanism, allowing the traveler to review, approve, or request revisions.
- **Adaptive Execution:** If feedback is provided (e.g., *"reduce hotel budget"* or *"swap day 3 for cultural activities"*), the state resumes and dynamically incorporates the human feedback into the final deliverable.

---

## 2. What We've Built and Why (Current Project Overview)

OrbitX is an end-to-end intelligent agent application composed of:
1. **Orchestration & State Machine:** A LangGraph state machine with cyclical conditional routing, state serialization, and `MemorySaver` in-memory checkpointing.
2. **Standardized Tool Integration via MCP:** Client integration with **Tavily Search MCP**, **AviationStack MCP**, and a custom **FastMCP Weather Server** for real-time live data retrieval.
3. **High-Performance Inference:** Powered by **Groq** (`ChatGroq`) for ultra-low-latency agent decision-making and synthesis.
4. **FastAPI Backend:** Asynchronous REST API with endpoints for initial draft generation (`/api/travel`), human approval/revision resumption (`/api/travel/approve`), health diagnostics, and static asset delivery.
5. **Modern, Distraction-Free UI:**
   - A warm, minimalist canvas that removes visual clutter (no bulky navbars or footers).
   - A single-screen Planner Console with Montreal/Canada quick prompts.
   - Interactive Human-in-the-Loop review section with live draft editing.
   - A custom A4 PDF export engine that prevents scroll-offset canvas bugs and protects table rows from being sliced across page boundaries.

```
+-----------------------------------------------------------------------------------+
|                                   USER INPUT                                      |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         SUPERVISOR AGENT & INPUT GUARDRAILS                       |
|   - Validates travel domain intent (blocks off-topic / prompt injections)         |
|   - Extracts constraints: origin, destination, duration, budget, style            |
|   - Selects required specialist agents & determines execution order               |
+----------------------------------------+------------------------------------------+
                                         |
               +-------------------------+-------------------------+
               | (If Allowed)                                      | (If Blocked)
               v                                                   v
+-----------------------------+                           +-------------------------+
|     SPECIALIST PIPELINE     |                           | GUARDRAIL BLOCKED AGENT |
|                             |                           | Returns polite boundary |
|  1. Flight Agent (MCP)      |                           +------------+------------+
|  2. Hotel Agent (MCP)       |                                        |
|  3. Weather Agent (MCP)     |                                        v
|  4. Budget Agent            |                                      (END)
|  5. Itinerary Drafter       |
+--------------+--------------+
               |
               v
+-----------------------------------------------------------------------------------+
|                         HUMAN-IN-THE-LOOP APPROVAL NODE                           |
|   - Pauses execution using LangGraph interrupt()                                  |
|   - State saved to MemorySaver checkpointer under thread_id                       |
|   - User can: [Approve Draft] OR [Provide Revision Feedback]                      |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                           FINAL RESPONSE AGENT                                    |
|   - Resumes graph with Command(resume={"approved": ..., "feedback": ...})         |
|   - Synthesizes specialist data + human feedback into final 7-part travel plan    |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        FASTAPI BACKEND & EXPORT ENGINE                            |
|   - Renders markdown with syntax highlighting                                     |
|   - Exports zero-offset, page-break-protected A4 PDFs with OrbitX official header |
+-----------------------------------------------------------------------------------+
```

---

## 3. Contents & File-by-File Technical Breakdown

Here is a comprehensive breakdown of every file and folder in the project and its role in the architecture:

| File / Directory | Purpose & Technical Role |
| :--- | :--- |
| **`app.py`** | **Web Application & REST API Entrypoint.** Built with FastAPI. Configures routes (`/`, `/api/travel`, `/api/travel/approve`, `/health`), mounts static files, performs request/response serialization with Pydantic, applies `nest_asyncio` for synchronous-to-asynchronous event loop bridging, and interfaces directly with the LangGraph runner functions. |
| **`backend.py`** | **Core Agent Intelligence & LangGraph Workflow.** Defines the global `TravelState` TypedDict schema, all 9 individual agent nodes, the Supervisor dynamic routing logic, conditional edge transitions, in-memory `MemorySaver` checkpointing, and external runner helpers (`run_travel_agent` and `resume_travel_agent`). |
| **`mcp_client.py`** | **Model Context Protocol (MCP) Bridge.** Manages the multi-server MCP client using `langchain-mcp-adapters`. Configures client subprocess environments (preserving SSL certificates and system environment paths) and connects to Tavily Search, AviationStack flight schedules, and the local custom weather server. |
| **`custom_weather_mcp_server.py`** | **Standalone FastMCP Weather Server.** A dedicated microservice using the `fastmcp` framework. Directly calls the OpenWeatherMap REST API to expose structured tools: `get_current_weather` and `get_weather_forecast` over standard MCP protocols. |
| **`templates/`** (`index.html`) | **Frontend Presentation Layer.** A Jinja2-templated HTML document containing the distraction-free Planner Console, Montreal/Canada quick-prompt trigger buttons, the real-time Supervisor reasoning accordion, the Human-in-the-Loop review card, and the markdown results container. |
| **`static/style.css`** | **Design System & Print Engine Styling.** Pure vanilla CSS establishing the warm cream-to-peach visual theme, card drop-shadows, responsive breakpoints, and critical `@media print` / `.pdf-export-container` rules that enforce `page-break-inside: avoid` on table rows and headers. |
| **`static/script.js`** | **Client Application Logic.** Handles asynchronous API communication with FastAPI endpoints (`fetch`), manages thread persistence in `localStorage`, displays live workflow chips, handles modal dialogs/toasts, and drives zero-offset, high-resolution A4 PDF generation via `html2pdf.js`. |
| **`requirements.txt`** | **Dependency Specifications.** Contains pinned dependencies including `fastapi`, `uvicorn`, `langgraph`, `langchain-groq`, `langchain-mcp-adapters`, `fastmcp`, `pydantic`, `jinja2`, and `certifi`. |
| **`.env`** | **Secrets & API Keys Configuration.** Stores environment variables for `GROQ_API_KEY`, `TAVILY_API_KEY`, `AVIATION_STACK_API_KEY`, and `OPENWEATHER_API_KEY`. |

---

## 4. FastAPI Architecture, Benefits & Comprehensive Endpoint Reference

### Why We Use FastAPI and How It Empowers OrbitX
FastAPI was chosen as the web framework for several strategic engineering reasons:
1. **High Concurrency & Asynchronous Non-Blocking I/O:** Multi-agent operations involve waiting on multiple external APIs (MCP tool servers, Tavily web search, Groq LLM inference). FastAPI's native `async/await` architecture ensures the server can handle concurrent user sessions without worker thread starvation.
2. **Robust Data Validation with Pydantic:** Incoming payloads are automatically parsed, validated, and cast to Pydantic models. Malformed requests (e.g., missing thread IDs or empty query strings) are caught and rejected immediately with clear error codes before triggering expensive LLM executions.
3. **Seamless State Checkpoint Bridging:** FastAPI allows clean decoupling between the initial graph invocation (`POST /api/travel`) and the Human-in-the-Loop graph resumption (`POST /api/travel/approve`), passing thread identifiers back and forth seamlessly.
4. **Auto-Generated Interactive Documentation:** FastAPI automatically generates OpenAPI-compliant Swagger documentation (`/docs`) and ReDoc (`/redoc`), allowing developers and interviewers to test endpoints interactively.
5. **Integrated Static & Template Serving:** Combines high-speed REST endpoints with `StaticFiles` and `Jinja2Templates` in a single unified service, eliminating CORS issues and multi-server configuration complexity.

---

### Detailed API Endpoint Breakdown

#### 1. `GET /` — Web Application Interface
- **Purpose:** Renders the primary OrbitX single-page application.
- **Response:** `HTMLResponse` rendering `templates/index.html`.
- **How It Works:** Uses `Jinja2Templates` to serve the warm cream-to-peach interface, loading the planner console and client scripts.

---

#### 2. `POST /api/travel` — Draft Generation & Agent Initiation
- **Purpose:** Initiates the multi-agent travel planning workflow for a user request.
- **Request Body (`TravelRequest` Pydantic model):**
  ```json
  {
    "message": "Plan a 7 days trip to Japan from Montreal under $3,500 CAD",
    "thread_id": "optional_existing_thread_id"
  }
  ```
- **Validation Logic:** Checks that `message` is not empty (returns HTTP 400 if blank). If no `thread_id` is passed, a unique UUID (`user_xxxxxxxx`) is generated.
- **Execution Workflow:**
  1. Invokes `run_travel_agent(user_message, thread_id)`.
  2. LangGraph executes: `START -> supervisor -> [specialists] -> itinerary_agent -> human_approval`.
  3. At `human_approval`, LangGraph triggers `interrupt()` and pauses execution.
  4. The state is serialized and returned to the client.
- **Success Response (HTTP 200 JSON):**
  ```json
  {
    "success": true,
    "thread_id": "user_bc1e658623b14ae3ba899b2b48ac546b",
    "answer": "### Draft Itinerary for 7 Days in Japan...",
    "requires_approval": true,
    "approval_request": "Please review the draft itinerary. Approve to finalize, or provide feedback for revision.",
    "selected_agents": ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
    "supervisor_reasoning": "User requested international journey from Montreal to Japan...",
    "trip_constraints": {
      "destination": "Japan",
      "origin": "Montreal, Canada",
      "duration": "7 days",
      "budget": "$3500 CAD"
    },
    "guardrail_allowed": true
  }
  ```
- **Error Response (HTTP 500 JSON):**
  ```json
  {
    "success": false,
    "error": "Error description message"
  }
  ```

---

#### 3. `POST /api/travel/approve` — Human-in-the-Loop Resumption
- **Purpose:** Resumes a paused LangGraph workflow after human evaluation.
- **Request Body (`ApprovalRequest` Pydantic model):**
  ```json
  {
    "thread_id": "user_bc1e658623b14ae3ba899b2b48ac546b",
    "approved": false,
    "feedback": "Reduce the hotel tier and allocate more budget for cultural activities."
  }
  ```
- **Validation Logic:** Enforces that `thread_id` is at least 1 character. If `approved` is `false`, `feedback` must not be blank (returns HTTP 400 with `"Please provide revision feedback when rejecting the draft."`).
- **Execution Workflow:**
  1. Calls `resume_travel_agent(thread_id, approved, feedback)`.
  2. LangGraph loads the checkpoint for `thread_id` from `MemorySaver`.
  3. Resumes execution from the `human_approval` node with `Command(resume={"approved": ..., "feedback": ...})`.
  4. Routes into `final_agent`, which applies the revision or polish.
  5. Completes execution at `END`.
- **Success Response (HTTP 200 JSON):**
  ```json
  {
    "success": true,
    "thread_id": "user_bc1e658623b14ae3ba899b2b48ac546b",
    "answer": "# 7-Day Japan Adventure — Montreal Departure\n\n## 1. Trip Summary...",
    "requires_approval": false,
    "approved": false,
    "human_feedback": "Reduce the hotel tier and allocate more budget for cultural activities."
  }
  ```

---

#### 4. `GET /health` — Operational Diagnostics
- **Purpose:** Endpoint for monitoring system health, uptime, and enabled features.
- **Response (HTTP 200 JSON):**
  ```json
  {
    "status": "ok",
    "message": "OrbitX API is running",
    "features": [
      "supervisor_agent",
      "input_guardrail",
      "human_in_the_loop"
    ]
  }
  ```

---

#### 5. `GET /favicon.ico` — Icon Handler
- **Purpose:** Prevents unnecessary 404 logs from browser favicon requests by returning an empty JSON payload with HTTP 200.

---

#### 6. Static File Mount (`/static`)
- **Mount Path:** `/static` -> maps to the local directory `BASE_DIR / "static"`.
- **Purpose:** Serves `style.css` and `script.js` with optimal browser caching.

---

## 5. Comprehensive Agent Catalog & Interaction Model

OrbitX does not use a single prompt. It employs **nine distinct agents and execution nodes**, each engineered for high cohesion and loose coupling.

---

### Agent 1: Supervisor Agent & Input Guardrail (`supervisor_agent`)
- **Purpose:** Acts as the primary gatekeeper, orchestrator, and triage manager of the system.
- **What Problem It Solves:** Prevents wasted compute on non-travel queries, guards against jailbreak attempts, and dynamically decomposes vague user requests into structured trip constraints.
- **Implementation & Logic:**
  - Evaluates the query against a strict input guardrail prompt (`guardrail_prompt`).
  - Emits JSON containing `allowed: bool` and `reason: str`.
  - If allowed, it extracts core parameters into `trip_constraints`:
    - `origin`, `destination`, `duration`, `budget`, `travel_style`, and `special_preferences`.
  - Determines which specialist agents are needed based on user intent (e.g., if the user only asks for flights, it skips hotel/itinerary specialists).
- **Inputs:** `state["user_query"]`.
- **Outputs to State:** `guardrail_allowed`, `guardrail_reason`, `trip_constraints`, `selected_agents`, `supervisor_reasoning`.
- **Interaction with Others:** Directly routes to either `guardrail_blocked` (if safe validation fails) or the first specialist in `selected_agents` (typically `flight_agent`).

---

### Agent 2: Guardrail Blocked Agent (`guardrail_blocked_agent`)
- **Purpose:** Terminal handling for out-of-scope or unsafe requests.
- **What Problem It Solves:** Prevents the application from crashing or producing unpredictable outputs when a user asks for coding advice, political opinions, or malicious exploits.
- **Outputs to State:** Friendly, professional boundary explanation guiding the user back to travel intelligence.
- **Interaction with Others:** Routes immediately to `END`.

---

### Agent 3: Flight Specialist Agent (`flight_agent`)
- **Purpose:** Discovers flight routes, airlines, layover details, and estimated pricing.
- **What Problem It Solves:** Eliminates made-up flight numbers and unrealistic schedules.
- **Tools & MCP Adapters Used:**
  - **AviationStack MCP Server:** Live airline flights and route data.
  - **Tavily MCP Search:** Fallback web intelligence for flight routes, estimated seasonal costs, and typical flight durations.
- **Inputs:** `state["user_query"]`, `state["trip_constraints"]`.
- **Outputs to State:** `flight_results`.
- **Interaction with Others:** Passes discovered transit data to `hotel_agent` and `budget_agent` so stay durations align with flight arrivals and flight costs factor into the overall budget.

---

### Agent 4: Hotel Specialist Agent (`hotel_agent`)
- **Purpose:** Identifies accommodation options matched to the traveler's style, location preferences, and budget tier.
- **What Problem It Solves:** Replaces generic hotel recommendations with neighborhood-specific options, price ranges, and verified amenities.
- **Tools & MCP Adapters Used:**
  - **Tavily MCP Search:** Real-time web intelligence querying hotels, boutique stays, hostels, and nightly rate estimates in the destination city.
- **Inputs:** `state["user_query"]`, `state["trip_constraints"]`, `state["flight_results"]`.
- **Outputs to State:** `hotel_results`.
- **Interaction with Others:** Passes lodging rates to `budget_agent` to calculate accommodation totals, and passes hotel locations to `itinerary_agent` to organize geographically logical daily excursions.

---

### Agent 5: Weather Specialist Agent (`weather_agent`)
- **Purpose:** Analyzes forecast patterns, climate trends, and packing advice for the chosen destination and dates.
- **What Problem It Solves:** Prevents travelers from booking monsoon-season itineraries or packing summer clothing for cold mountain regions.
- **Tools & MCP Adapters Used:**
  - **Custom FastMCP Weather Server (`custom_weather_mcp_server.py`):** Directly queries OpenWeatherMap API for live temperatures, rain probabilities, and forecasts.
  - **Tavily MCP Search:** Seasonal climate overviews when queries target dates further in the future than typical 5-day API windows.
- **Inputs:** `state["user_query"]`, `state["trip_constraints"]`.
- **Outputs to State:** `weather_results`.
- **Interaction with Others:** Feeds weather data to `itinerary_agent` (e.g., schedule indoor museum visits on rainy days and outdoor hikes on clear days).

---

### Agent 6: Budget Specialist Agent (`budget_agent`)
- **Purpose:** Synthesizes flight estimates, accommodation costs, daily food, local transit, activities, and emergency buffers into an itemized financial plan.
- **What Problem It Solves:** Solves the common travel-planning pitfall of hidden expenses and unrealistic budget allocation.
- **Inputs:** `trip_constraints`, `flight_results`, `hotel_results`, `weather_results`.
- **Outputs to State:** `budget_results` (Itemized breakdown with Flight, Stay, Daily Food, Local Metro, Activities, SIM/eSIM, Emergency contingency, and Total).
- **Interaction with Others:** Informs `itinerary_agent` whether activities should be high-end or budget-friendly, and provides the user with an explicit breakdown before they commit to booking.

---

### Agent 7: Itinerary Drafter Agent (`itinerary_agent`)
- **Purpose:** Synthesizes all specialist intelligence into a coherent, preliminary Day-by-Day travel draft.
- **What Problem It Solves:** Merges disparate facts into a practical, timed narrative ready for human evaluation.
- **Inputs:** Combines `trip_constraints`, `flight_results`, `hotel_results`, `weather_results`, and `budget_results`.
- **Outputs to State:** `itinerary`, `approval_request`.
- **Interaction with Others:** Forwards the state to the `human_approval` node.

---

### Agent 8: Human-in-the-Loop Approval Node (`human_approval_agent`)
- **Purpose:** Implements stateful suspension of the autonomous graph to allow human review.
- **What Problem It Solves:** Autonomous AI should never make irreversible travel plans without human consent. This node guarantees traveler agency.
- **How It Works Under the Hood:**
  - Invokes LangGraph's native `interrupt({ ... })` function.
  - LangGraph halts graph execution and commits the state snapshot into the `MemorySaver` checkpointer under the assigned `thread_id`.
  - The FastAPI server receives the interrupted state and delivers the draft itinerary and feedback prompt to the frontend.
  - The graph remains safely suspended in memory until the user clicks **Approve** or **Revise** in the UI.
- **Resumption Mechanism:**
  - Calling `/api/travel/approve` invokes `travel_graph.invoke(Command(resume={"approved": bool, "feedback": str}), config={"configurable": {"thread_id": thread_id}})`.
- **Outputs to State:** `approved: bool`, `human_feedback: str`.
- **Interaction with Others:** Passes approval status and revision feedback to `final_agent`.

---

### Agent 9: Final Response Synthesizer Agent (`final_agent`)
- **Purpose:** Assembles the definitive, publication-ready travel plan.
- **What Problem It Solves:** Ensures that user revision feedback is strictly respected and the final output follows a clean, standardized, beautifully structured 7-section format.
- **Execution Logic:**
  - If `approved == True`: Polishes the draft while preserving all validated decisions.
  - If `approved == False`: Specifically instructs the LLM to rewrite the itinerary around the user's feedback (e.g., swapping a hotel, adding a free leisure day, changing arrival airports).
- **Outputs to State:** `final_response` formatted into:
  1. *Trip Summary*
  2. *Flight Information*
  3. *Hotel Suggestions*
  4. *Weather Information & Packing Advice*
  5. *Day-by-Day Itinerary*
  6. *Estimated Budget & Currency Breakdown*
  7. *Final Recommendations & Local Tips*
- **Interaction with Others:** Routes to `END`.

---

## 6. Architectural Deep Dive: LangGraph & MCP Integration

### Why LangGraph Instead of Simple Chains?
| Feature | Simple LangChain Chain / Linear Pipeline | LangGraph Multi-Agent Architecture |
| :--- | :--- | :--- |
| **State Persistence** | Stateless; memory lost between calls | Stateful via `StateGraph` and `MemorySaver` checkpoints |
| **Routing** | Rigid linear execution (A -> B -> C) | Dynamic conditional routing based on supervisor evaluation |
| **Interruption (HITL)** | Requires complex external queues | Native `interrupt()` and `Command(resume=...)` semantics |
| **Agent Isolation** | One giant prompt prone to context confusion | Specialized agents with focused prompts and tools |
| **Error Recovery** | Fails entirely if one tool breaks | Supervisor can degrade gracefully or route around errors |

### Why the Model Context Protocol (MCP)?
MCP is an open standard created by Anthropic that standardizes how LLM applications interact with external data sources and tools.
- **Decoupled Tool Servers:** Weather, flight search, and web scrapers run as dedicated tool servers.
- **Transport Flexibility:** Tools can run over `stdio` (local subprocesses) or `SSE` (remote endpoints).
- **Modularity:** Upgrading a weather provider or flight API requires editing only the MCP server without touching agent orchestration code.

---

## 7. Step-by-Step Local Setup & Execution Guide

Follow these instructions to run OrbitX on your local system.

### Step 1: System Prerequisites
- **Operating System:** Windows 10/11, macOS, or Linux.
- **Python:** Python 3.10, 3.11, or 3.12 installed.
- **Package Management:** `pip` and (optionally) `uv` / `uvx` for fast MCP server execution.

### Step 2: Clone the Repository
```bash
git clone https://github.com/Neelendra-Mishra/OrbitX_Project.git
cd OrbitX_Project/Multi-Agent-System-using-LangGraph-MCP-Supervisor-Guardrails-HITL
```

### Step 3: Set Up a Python Virtual Environment
**On Windows (PowerShell):**
```powershell
python -m venv ai_project_venv
.\ai_project_venv\Scripts\Activate.ps1
```
*(If PowerShell restricts scripts, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

**On macOS / Linux:**
```bash
python3 -m venv ai_project_venv
source ai_project_venv/bin/activate
```

### Step 4: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5: Configure Environment Variables (`.env`)
Create or edit `.env` in the project root directory:
```env
# Required: Groq LLM API Key (fast inference)
GROQ_API_KEY=your_groq_api_key_here

# Required: Tavily Search API Key (web travel intelligence)
TAVILY_API_KEY=your_tavily_api_key_here

# Optional / Recommended: Real-time Aviation & Weather
AVIATION_STACK_API_KEY=your_aviationstack_api_key_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
```

### Step 6: Start the OrbitX Application
```bash
python app.py
```
*The server will initialize on `http://127.0.0.1:8000` with hot-reload enabled.*

### Step 7: Access the Web Interface
1. Open your browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```
2. Test one of the pre-configured Montreal example buttons:
   - **🌸 Japan 7 Days:** `"Plan a complete 7 days Japan trip from Montreal, Canada including flights, hotels and sightseeing under $3,500 CAD."`
   - **🏙️ Dubai Trip:** `"Plan a 5 days Dubai trip from Montreal, Canada with flights, hotels and sightseeing."`
   - **🏝️ Thailand Budget:** `"Plan a 7 days Thailand trip from Montreal, Canada with budget hotels and sightseeing."`
3. Observe:
   - Supervisor reasoning and activated agent chips.
   - The Human-in-the-Loop approval card pausing execution.
   - Enter revision feedback or click **Approve** to generate the final formatted itinerary.
   - Click **Download PDF** to export a clean, A4-formatted, page-break-protected travel report.

---

*Engineered by Neelendra Mishra — OrbitX Autonomous Travel Intelligence Project.*
