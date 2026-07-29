const selectAll = (selector, root = document) => [...root.querySelectorAll(selector)];

const setPressed = (buttons, activeButton) => {
    buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button === activeButton));
    });
};

const byteLength = (value) => new TextEncoder().encode(value).length;
const pad = (value) => String(value).padStart(2, "0");

/* Atlas cutaway */

const stackMap = document.querySelector("[data-stack-map]");

if (stackMap) {
    const details = {
        model: {
            label: "LLM endpoint · outside",
            text: "Inference runs in another process and may run on another machine. Only the Rust model client crosses this boundary over HTTP; the Wasm component never talks to the model directly.",
        },
        loop: {
            label: "Prompt loop · main thread",
            text: "Current orchestration is a synchronous Rust call stack. It owns conversation messages, parses untrusted tool calls, routes a capability, and blocks during model and component calls.",
        },
        runtime: {
            label: "Wasmtime · same calling thread",
            text: "A Store is an execution context, not a thread. The main thread enters compiled guest code in a fresh Store and instance; the guest has its own bounded linear memory.",
        },
        timer: {
            label: "Deadline · helper thread",
            text: "Each describe or invoke call starts a short-lived OS thread. It waits for the timeout and increments the engine epoch only on expiry, causing a trap—not a cooperative time slice.",
        },
        linker: {
            label: "Linker · authority surface",
            text: "The current component imports nothing and the host supplies nothing. No filesystem, network, clock, random, environment, or credential function is reachable from guest code.",
        },
    };
    const buttons = selectAll("[data-stack-node]", stackMap);
    const label = stackMap.querySelector("[data-stack-readout-label]");
    const readout = stackMap.querySelector("[data-stack-readout]");

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const detail = details[button.dataset.stackNode];
            if (!detail) return;
            const wasActive = button.getAttribute("aria-pressed") === "true";
            buttons.forEach((candidate) => candidate.setAttribute("aria-pressed", "false"));
            if (wasActive) {
                label.textContent = "Select a layer";
                readout.textContent = "Every box says both what runs and where it runs. Choose one to inspect it.";
                return;
            }
            button.setAttribute("aria-pressed", "true");
            label.textContent = detail.label;
            readout.textContent = detail.text;
        });
    });
}

/* Linker laboratory */

const linkerLab = document.querySelector("[data-linker-lab]");

if (linkerLab) {
    const componentProfiles = {
        current: {
            imports: [],
            label: "the current import-free provider",
        },
        narrow: {
            imports: ["dekopon:provider-io/http.request"],
            label: "the illustrative narrow-I/O provider",
        },
        wasi: {
            imports: [
                "wasi:filesystem/types",
                "wasi:sockets/tcp",
                "wasi:clocks/monotonic-clock",
                "wasi:random/random",
            ],
            label: "the WASI-oriented provider",
        },
    };
    const linkerProfiles = {
        empty: {
            definitions: [],
            label: "empty linker",
        },
        narrow: {
            definitions: ["dekopon:provider-io/http.request"],
            label: "narrow host linker",
        },
        wasi: {
            definitions: [
                "wasi:filesystem/types",
                "wasi:sockets/tcp",
                "wasi:clocks/monotonic-clock",
                "wasi:random/random",
            ],
            label: "WASI linker",
        },
    };
    const authorityText = {
        "dekopon:provider-io/http.request": "One illustrative broker-filtered HTTP operation; its destination and credential scope would have to come from authorization.",
        "wasi:filesystem/types": "WASI filesystem types and any linked operations that use them.",
        "wasi:sockets/tcp": "TCP socket operations exposed by the selected WASI implementation.",
        "wasi:clocks/monotonic-clock": "A monotonic clock supplied by the host.",
        "wasi:random/random": "Host-supplied random bytes.",
    };

    let componentProfile = "current";
    let linkerProfile = "empty";
    const componentButtons = selectAll("[data-component-profile]", linkerLab);
    const linkerButtons = selectAll("[data-linker-profile]", linkerLab);
    const importsList = linkerLab.querySelector("[data-linker-imports]");
    const definitionsList = linkerLab.querySelector("[data-linker-definitions]");
    const authority = linkerLab.querySelector("[data-linker-authority]");
    const sockets = selectAll(".linker-socket > span", linkerLab);
    const socketLabel = linkerLab.querySelector("[data-linker-socket-label]");
    const result = linkerLab.querySelector("[data-linker-result]");
    const resultMark = linkerLab.querySelector("[data-linker-result-mark]");
    const resultTitle = linkerLab.querySelector("[data-linker-result-title]");
    const resultDetail = linkerLab.querySelector("[data-linker-result-detail]");

    const renderList = (element, values) => {
        element.replaceChildren();
        if (values.length === 0) {
            const item = document.createElement("li");
            item.className = "is-empty";
            item.textContent = "∅ none";
            element.append(item);
            return;
        }
        values.forEach((value) => {
            const item = document.createElement("li");
            item.textContent = value;
            element.append(item);
        });
    };

    const renderLinker = () => {
        const component = componentProfiles[componentProfile];
        const host = linkerProfiles[linkerProfile];
        const missing = component.imports.filter((item) => !host.definitions.includes(item));
        const matched = component.imports.filter((item) => host.definitions.includes(item));

        renderList(importsList, component.imports);
        renderList(definitionsList, host.definitions);
        sockets.forEach((socket, index) => {
            socket.className = "";
            if (index < component.imports.length) {
                socket.classList.add(missing.includes(component.imports[index]) ? "is-missing" : "is-matched");
            }
        });
        socketLabel.textContent = `${matched.length} match${matched.length === 1 ? "" : "es"}`;

        if (matched.length === 0) {
            authority.textContent = "No host function is reachable through this component's imports.";
        } else {
            authority.textContent = matched.map((item) => authorityText[item]).join(" ");
        }

        const succeeds = missing.length === 0;
        result.classList.toggle("is-success", succeeds);
        result.classList.toggle("is-error", !succeeds);
        resultMark.textContent = succeeds ? "✓" : "×";
        if (succeeds) {
            resultTitle.textContent = "Instantiation succeeds";
            resultDetail.textContent = component.imports.length === 0
                ? `${component.label} requests no imports, so the ${host.label} satisfies it. Extra host definitions remain unreachable because the guest did not import them.`
                : `Every import requested by ${component.label} has an exact definition in the ${host.label}.`;
        } else {
            resultTitle.textContent = "Instantiation fails closed";
            resultDetail.textContent = `Missing ${missing.join(", ")}. Wasmtime does not silently stub an unresolved component import.`;
        }
    };

    componentButtons.forEach((button) => {
        button.addEventListener("click", () => {
            componentProfile = button.dataset.componentProfile;
            setPressed(componentButtons, button);
            renderLinker();
        });
    });
    linkerButtons.forEach((button) => {
        button.addEventListener("click", () => {
            linkerProfile = button.dataset.linkerProfile;
            setPressed(linkerButtons, button);
            renderLinker();
        });
    });
    renderLinker();
}

/* Boundary laboratory */

const boundaryLab = document.querySelector("[data-boundary-lab]");

if (boundaryLab) {
    const input = boundaryLab.querySelector("[data-boundary-input]");
    const transformSelect = boundaryLab.querySelector("[data-boundary-transform]");
    const error = boundaryLab.querySelector("[data-boundary-error]");
    const strategyButtons = selectAll("[data-boundary-strategy]", boundaryLab);
    const bytesMetric = boundaryLab.querySelector("[data-boundary-bytes]");
    const codecsMetric = boundaryLab.querySelector("[data-boundary-codecs]");
    const copiesMetric = boundaryLab.querySelector("[data-boundary-copies]");
    const schemaMetric = boundaryLab.querySelector("[data-boundary-schema]");
    const hostType = boundaryLab.querySelector("[data-boundary-host-type]");
    const hostValue = boundaryLab.querySelector("[data-boundary-host-value]");
    const wireType = boundaryLab.querySelector("[data-boundary-wire-type]");
    const wireValue = boundaryLab.querySelector("[data-boundary-wire-value]");
    const guestType = boundaryLab.querySelector("[data-boundary-guest-type]");
    const guestValue = boundaryLab.querySelector("[data-boundary-guest-value]");
    const outputType = boundaryLab.querySelector("[data-boundary-output-type]");
    const outputValue = boundaryLab.querySelector("[data-boundary-output-value]");
    const memoryLabel = boundaryLab.querySelector("[data-memory-label]");
    const memoryAddress = boundaryLab.querySelector("[data-memory-address]");
    const memoryCaveat = boundaryLab.querySelector("[data-memory-caveat]");
    const memoryHex = boundaryLab.querySelector("[data-memory-hex]");
    const memoryAscii = boundaryLab.querySelector("[data-memory-ascii]");
    const explanationTitle = boundaryLab.querySelector("[data-boundary-explanation-title]");
    const explanation = boundaryLab.querySelector("[data-boundary-explanation]");

    let strategy = "json";

    const ransomCase = (message) => {
        let uppercase = false;
        let result = "";
        for (const character of Array.from(message)) {
            let isLetter = false;
            try {
                isLetter = /\p{Alphabetic}/u.test(character);
            } catch {
                isLetter = character.toLowerCase() !== character.toUpperCase();
            }
            if (!isLetter) {
                result += character;
                continue;
            }
            result += uppercase ? character.toUpperCase() : character.toLowerCase();
            uppercase = !uppercase;
        }
        return result;
    };

    const invokeEcho = (capability, value) => {
        if (capability === "echo.echo") return { ok: true, output: value };
        const keys = Object.keys(value);
        if (keys.length !== 1 || typeof value.message !== "string") {
            return {
                ok: false,
                error: {
                    code: "invalid-input",
                    message: "input must contain exactly one string field named \"message\"",
                },
            };
        }
        const operations = {
            "echo.reverse": (message) => Array.from(message).reverse().join(""),
            "echo.upcase": (message) => Array.from(message, (character) => character.toUpperCase()).join(""),
            "echo.downcase": (message) => Array.from(message, (character) => character.toLowerCase()).join(""),
            "echo.ransom-case": ransomCase,
        };
        return { ok: true, output: { message: operations[capability](value.message) } };
    };

    const format = (value) => JSON.stringify(value, null, 2);
    const compact = (value) => JSON.stringify(value);
    const printableByte = (value) => (value >= 32 && value <= 126 ? String.fromCharCode(value) : "·");

    const showMemory = (bytes, label, address, caveat) => {
        memoryLabel.textContent = label;
        memoryAddress.textContent = address;
        memoryCaveat.textContent = caveat;
        const shown = bytes.slice(0, 64);
        memoryHex.textContent = shown.map((value) => value.toString(16).padStart(2, "0")).join(" ")
            + (bytes.length > shown.length ? " …" : "");
        memoryAscii.textContent = shown.map(printableByte).join("")
            + (bytes.length > shown.length ? "…" : "");
    };

    const showInvalid = (message) => {
        error.textContent = message;
        error.classList.add("is-error");
        [bytesMetric, codecsMetric, copiesMetric, schemaMetric].forEach((element) => {
            element.textContent = "—";
        });
        hostType.textContent = "parse rejected";
        hostValue.textContent = input.value;
        wireType.textContent = "not crossed";
        wireValue.textContent = "—";
        guestType.textContent = "not invoked";
        guestValue.textContent = "—";
        outputType.textContent = "host error";
        outputValue.textContent = "—";
        showMemory([], "No guest allocation", "—", "Invalid host input is rejected before the component call.");
    };

    const renderBoundary = () => {
        let value;
        try {
            value = JSON.parse(input.value);
        } catch (parseError) {
            showInvalid(`Invalid JSON · ${parseError.message}`);
            return;
        }
        if (value === null || Array.isArray(value) || typeof value !== "object") {
            showInvalid("Valid JSON, but the host requires a top-level object.");
            return;
        }

        error.classList.remove("is-error");
        error.textContent = "Valid object · the provider still owns capability-specific validation.";
        const capability = transformSelect.value;
        const result = invokeEcho(capability, value);
        const inputJson = compact(value);
        const response = result.ok
            ? { outcome: "succeeded", output: result.output }
            : { outcome: "failed", error: result.error };
        const responseJson = compact(response);
        const inputBytes = [...new TextEncoder().encode(inputJson)];
        const message = typeof value.message === "string" ? value.message : inputJson;
        const messageBytes = [...new TextEncoder().encode(message)];

        hostValue.textContent = format(value);
        outputValue.textContent = format(response);

        if (strategy === "json") {
            bytesMetric.textContent = `${inputBytes.length} B UTF-8`;
            codecsMetric.textContent = "2 encode · 2 decode";
            copiesMetric.textContent = "2 payload strings + capability ID";
            schemaMetric.textContent = "runtime JSON";
            hostType.textContent = "serde_json::Value";
            wireType.textContent = "WIT string";
            wireValue.textContent = `ptr: 0x1000 (illustrative)\nlen: ${inputBytes.length}\n${inputJson}`;
            guestType.textContent = "serde_json::Value";
            guestValue.textContent = format(value);
            outputType.textContent = `tagged JSON · ${byteLength(responseJson)} B`;
            explanationTitle.textContent = "Current: simple contract, repeated serialization";
            explanation.textContent = "The host encodes a Value, the canonical ABI transfers a WIT string, the guest decodes it, and the same encode/transfer/decode sequence returns a tagged response.";
            showMemory(
                inputBytes,
                "Illustrative guest string allocation",
                `offset 0x1000 · ${inputBytes.length} UTF-8 bytes`,
                "The offset is pedagogical; the component allocator chooses the real location.",
            );
        } else if (strategy === "typed") {
            bytesMetric.textContent = `${messageBytes.length} B string data`;
            codecsMetric.textContent = "generated lift / lower";
            copiesMetric.textContent = "typed value transfers";
            schemaMetric.textContent = "WIT contract";
            hostType.textContent = "generated HostInput record";
            wireType.textContent = "WIT record { message: string }";
            wireValue.textContent = `flat fields + string(offset, len=${messageBytes.length})`;
            guestType.textContent = "generated GuestInput record";
            guestValue.textContent = typeof value.message === "string"
                ? `HostInput {\n  message: ${JSON.stringify(value.message)}\n}`
                : "This record shape would reject an input without a string message.";
            outputType.textContent = "WIT result / variant";
            explanationTitle.textContent = "Typed WIT: remove the inner JSON envelope";
            explanation.textContent = "Generated bindings validate the record and result shape. Strings and lists still occupy guest memory and still require canonical lifting/lowering; typed does not mean zero-copy.";
            showMemory(
                messageBytes,
                "String field in guest linear memory",
                `illustrative offset · ${messageBytes.length} UTF-8 bytes`,
                "Scalar record fields can flatten into core values; variable-length string data still uses memory.",
            );
        } else if (strategy === "binary") {
            const length = inputBytes.length;
            const binaryBytes = [
                length & 0xff,
                (length >>> 8) & 0xff,
                (length >>> 16) & 0xff,
                (length >>> 24) & 0xff,
                ...inputBytes,
            ];
            bytesMetric.textContent = `${binaryBytes.length} B illustration`;
            codecsMetric.textContent = "2 binary encode / decode";
            copiesMetric.textContent = "2 byte-list transfers";
            schemaMetric.textContent = "codec dependent";
            hostType.textContent = "Vec<u8>";
            wireType.textContent = "WIT list<u8>";
            wireValue.textContent = `[${binaryBytes.slice(0, 12).join(", ")}${binaryBytes.length > 12 ? ", …" : ""}]`;
            guestType.textContent = "decoded provider input";
            guestValue.textContent = format(value);
            outputType.textContent = "binary response bytes";
            explanationTitle.textContent = "Binary bytes: potentially compact, still a codec and a copy";
            explanation.textContent = "A real CBOR, MessagePack, or Protobuf encoding could reduce size or add schema discipline. This toy uses a length-prefixed UTF-8 illustration, not one of those codecs. The byte list still crosses linear memory.";
            showMemory(
                binaryBytes,
                "Illustrative length-prefixed binary envelope",
                `illustrative offset · ${binaryBytes.length} bytes`,
                "This is deliberately not labeled as CBOR or MessagePack; exact bytes require the selected codec.",
            );
        } else {
            const handleBytes = [0x2a, 0x00, 0x00, 0x00];
            bytesMetric.textContent = "4 B handle index";
            codecsMetric.textContent = "no bulk payload codec";
            copiesMetric.textContent = "host calls instead";
            schemaMetric.textContent = "resource methods";
            hostType.textContent = "host-owned ValueEntry";
            wireType.textContent = "own<host-value> #42";
            wireValue.textContent = "resource table index: 42";
            guestType.textContent = "generated resource handle";
            guestValue.textContent = "host_value.transform(capability)";
            outputType.textContent = "resource or typed result";
            explanationTitle.textContent = "Resource handle: keep bulk or sensitive state in the host";
            explanation.textContent = "The guest receives an opaque index and can call only linked methods. This can avoid moving a large body, but every method is a host authority surface with lifetime, revocation, TOCTOU, and call-count limits.";
            showMemory(
                handleBytes,
                "Illustrative resource-table handle",
                "handle #42 · 4 illustrative bytes",
                "The host-owned value is not copied into guest memory; the guest also cannot dereference it directly.",
            );
        }
    };

    strategyButtons.forEach((button) => {
        button.addEventListener("click", () => {
            strategy = button.dataset.boundaryStrategy;
            setPressed(strategyButtons, button);
            renderBoundary();
        });
    });
    input.addEventListener("input", renderBoundary);
    transformSelect.addEventListener("change", renderBoundary);
    renderBoundary();
}

/* Run lifecycle explorer */

const lifecycleLab = document.querySelector("[data-lifecycle-lab]");

if (lifecycleLab) {
    const timelines = {
        current: [
            {
                status: "Current · process start",
                title: "Parse CLI and create the registry",
                detail: "The main OS thread parses arguments, creates one Wasmtime engine, and begins compiling each selected component.",
                where: "dekopon-run / main OS thread",
                data: "CLI options, host limits, component bytes",
                crossing: "none",
                executing: ["run-process", "main-thread", "prompt-loop"],
                resident: ["run-process"],
                crossingNodes: [],
            },
            {
                status: "Current · component discovery",
                title: "Describe the component in a fresh Store",
                detail: "The main thread takes the shared runtime mutex, instantiates with an empty linker, and calls the describe export. A temporary deadline thread watches the call.",
                where: "dekopon-run / main + deadline helper OS threads",
                data: "fresh Store, instance, guest manifest string",
                crossing: "host ↔ guest canonical ABI, same process",
                executing: ["main-thread", "wasm-store", "deadline-thread"],
                resident: ["guest-memory"],
                crossingNodes: ["wasm-store"],
            },
            {
                status: "Current · prompt setup",
                title: "Turn capabilities into model tools",
                detail: "Rust sorts capability IDs, adapts them to function names, and builds object-shaped tool schemas. No provider code runs during this step.",
                where: "dekopon-run / main OS thread",
                data: "messages, tool names, descriptions, JSON Schemas",
                crossing: "none",
                executing: ["main-thread", "prompt-loop"],
                resident: ["prompt-loop"],
                crossingNodes: [],
            },
            {
                status: "Current · model turn 1",
                title: "Block on the model endpoint",
                detail: "The blocking Rust client serializes the conversation and tool declarations. The main thread waits while inference happens in another process or machine.",
                where: "client: main OS thread / inference: external service",
                data: "prompt, tool schemas, bearer credential inside model client",
                crossing: "HTTP or SSE process/machine boundary",
                executing: ["model-client", "model-endpoint"],
                resident: ["prompt-loop", "model-client"],
                crossingNodes: ["model-network"],
            },
            {
                status: "Current · untrusted proposal",
                title: "Parse and route the model tool call",
                detail: "Rust checks that the function name was offered, parses its argument string as a JSON object, and maps it back to one canonical capability ID.",
                where: "dekopon-run / main OS thread",
                data: "untrusted tool name, call ID, JSON arguments",
                crossing: "none; parsing is not authorization",
                executing: ["main-thread", "prompt-loop"],
                resident: ["prompt-loop"],
                crossingNodes: [],
            },
            {
                status: "Current · immediate component call",
                title: "Invoke guest computation synchronously",
                detail: "The main thread serializes arguments, holds the runtime mutex, creates a fresh Store and instance, and enters the Wasm export. The linker remains empty.",
                where: "dekopon-run / main thread in Wasmtime guest code",
                data: "JSON string in fresh guest linear memory",
                crossing: "canonical ABI inside one process",
                executing: ["main-thread", "wasm-store", "guest-memory", "deadline-thread"],
                resident: ["guest-memory"],
                crossingNodes: ["wasm-store"],
            },
            {
                status: "Current · untrusted result",
                title: "Lift and validate the component response",
                detail: "Wasmtime lifts the returned string. Rust bounds its size, decodes the tagged response, and serializes the raw output as a tool-result message.",
                where: "dekopon-run / main OS thread",
                data: "ComponentResponse, raw JSON output, correlated tool call ID",
                crossing: "guest → host canonical ABI",
                executing: ["main-thread", "wasm-store", "prompt-loop"],
                resident: ["prompt-loop"],
                crossingNodes: ["wasm-store"],
            },
            {
                status: "Current · model turn 2",
                title: "Send the tool result back to the model",
                detail: "The blocking model client sends prior assistant state plus the provider output. The model endpoint returns final text or another bounded tool turn.",
                where: "client: main OS thread / inference: external service",
                data: "conversation state and untrusted provider output",
                crossing: "HTTP or SSE process/machine boundary",
                executing: ["model-client", "model-endpoint"],
                resident: ["prompt-loop"],
                crossingNodes: ["model-network"],
            },
            {
                status: "Current · command complete",
                title: "Print final text and exit",
                detail: "Rust writes the model's final answer to stdout. The registry, compiled components, engine, and all in-memory conversation state disappear with the process.",
                where: "dekopon-run / main OS thread",
                data: "final untrusted model text",
                crossing: "stdout to parent shell",
                executing: ["main-thread", "prompt-loop", "operator"],
                resident: ["run-process"],
                crossingNodes: [],
            },
        ],
        future: [
            {
                status: "Future · orchestration",
                title: "Start an unprivileged agent task",
                detail: "A task inside dekopond owns context and conversation state. Tokio worker count and task placement are implementation choices, not authority boundaries.",
                where: "dekopond process / Tokio agent task*",
                data: "task, context, conversation, agent capability declarations",
                crossing: "none",
                executing: ["daemon-process", "daemon-runtime", "agent-task"],
                resident: ["agent-task"],
                crossingNodes: [],
            },
            {
                status: "Future · model I/O",
                title: "Await an external model turn",
                detail: "The daemon's model-client task serializes the prompt and awaits network I/O. The worker can poll another ready task while the model endpoint runs elsewhere.",
                where: "dekopond task + external model process",
                data: "prompt, schemas, model credential confined to model client",
                crossing: "HTTP/SSE process or machine boundary",
                executing: ["future-model-client", "future-model-endpoint"],
                resident: ["agent-task", "future-model-client"],
                crossingNodes: ["future-model-network"],
            },
            {
                status: "Future · proposal only",
                title: "Convert the model call into a proposal",
                detail: "The model-selected capability and arguments remain untrusted. The daemon may construct ProposedInvocation, but it cannot construct broker authority.",
                where: "dekopond process / agent task",
                data: "ProposedInvocation and untrusted arguments",
                crossing: "none yet",
                executing: ["agent-task", "daemon-process"],
                resident: ["agent-task"],
                crossingNodes: [],
            },
            {
                status: "Future · trusted boundary",
                title: "Send an authenticated proposal envelope",
                detail: "The proposal crosses into a separately deployed broker with trusted principal/workload context, freshness, and replay protection. Exact transport is not implemented.",
                where: "dekopond → dekopon-brokerd",
                data: "proposal + authenticated envelope context",
                crossing: "OS process and pod boundary",
                executing: ["agent-task", "broker-transport", "broker-process"],
                resident: ["agent-task"],
                crossingNodes: ["broker-transport"],
            },
            {
                status: "Future · broker decision",
                title: "Authenticate and evaluate policy",
                detail: "Broker code resolves trusted identity and policy input. A denial returns without provider execution; this playback follows the authorized branch.",
                where: "dekopon-brokerd process / broker task*",
                data: "trusted actor, policy revision, proposal, decision context",
                crossing: "none; broker-owned transition",
                executing: ["broker-process", "broker-runtime", "policy-task"],
                resident: ["broker-secrets", "policy-task"],
                crossingNodes: [],
            },
            {
                status: "Future · authorization",
                title: "Create constrained authorization inside the broker",
                detail: "The broker binds the proposal, decision receipt, timeout, output and future network constraints. This state is consumed locally, not returned as a bearer grant.",
                where: "dekopon-brokerd process",
                data: "AuthorizedInvocation, receipt, constraints, scoped credentials",
                crossing: "none",
                executing: ["policy-task", "broker-secrets"],
                resident: ["broker-secrets"],
                crossingNodes: [],
            },
            {
                status: "Future · bounded guest",
                title: "Create a fresh Store and enter the provider",
                detail: "The broker reuses the Engine and compiled component but gives this invocation a fresh Store, instance, memory, authorization-backed host state, and aggregate admission slot.",
                where: "dekopon-brokerd / Wasmtime call future on a Tokio worker*",
                data: "fresh Store, bounded guest memory, invocation-scoped host state",
                crossing: "host ↔ guest canonical ABI",
                executing: ["broker-runtime", "future-wasm-store"],
                resident: ["future-wasm-store", "broker-secrets"],
                crossingNodes: ["future-wasm-store"],
            },
            {
                status: "Future · asynchronous host import",
                title: "Suspend the guest while provider I/O waits",
                detail: "A narrow linked host function derives destination and credentials from broker state. Wasmtime suspends the guest fiber when the Rust future returns Pending.",
                where: "broker Tokio task; guest suspended without holding the worker*",
                data: "bounded request; credentials remain host-side",
                crossing: "guest import → trusted Rust host function",
                executing: ["host-import", "broker-secrets", "broker-runtime"],
                resident: ["future-wasm-store", "broker-secrets"],
                crossingNodes: ["host-import"],
            },
            {
                status: "Future · external effect",
                title: "Call the constrained provider endpoint",
                detail: "The host I/O future crosses to the external service. Timeout, destination, size, retries, and idempotency must be enforced by broker-owned code.",
                where: "broker client task + external provider service",
                data: "scoped request and provider response",
                crossing: "network / external trust boundary",
                executing: ["host-import", "provider-network", "external-provider"],
                resident: ["broker-secrets"],
                crossingNodes: ["provider-network"],
            },
            {
                status: "Future · evidence",
                title: "Validate output and append evidence",
                detail: "The guest resumes, returns a bounded result, and the broker links outcome, decision, policy revision, receipt, and evidence under invocation and trace identifiers.",
                where: "dekopon-brokerd process / invocation + audit tasks*",
                data: "InvocationResult, evidence, audit linkage",
                crossing: "external response → host → guest → host",
                executing: ["future-wasm-store", "audit-task", "broker-runtime"],
                resident: ["audit-task"],
                crossingNodes: ["host-import"],
            },
            {
                status: "Future · result, not authority",
                title: "Return the result to the daemon",
                detail: "The broker sends a bounded result and evidence reference across the process boundary. AuthorizedInvocation remains internal and is no longer usable after execution.",
                where: "dekopon-brokerd → dekopond",
                data: "result, denial/failure detail, evidence reference",
                crossing: "authenticated process boundary",
                executing: ["broker-transport", "agent-task"],
                resident: ["agent-task", "audit-task"],
                crossingNodes: ["broker-transport"],
            },
        ],
    };

    let mode = "current";
    let index = 0;
    let timer = null;
    const modeButtons = selectAll("[data-lifecycle-mode]", lifecycleLab);
    const maps = selectAll("[data-lifecycle-map]", lifecycleLab);
    const previous = lifecycleLab.querySelector("[data-life-previous]");
    const next = lifecycleLab.querySelector("[data-life-next]");
    const play = lifecycleLab.querySelector("[data-life-play]");
    const playIcon = play.querySelector("span");
    const playLabel = play.querySelector("strong");
    const count = lifecycleLab.querySelector("[data-life-step-count]");
    const progress = lifecycleLab.querySelector("[data-life-progress]");
    const eventIndex = lifecycleLab.querySelector("[data-life-event-index]");
    const eventStatus = lifecycleLab.querySelector("[data-life-event-status]");
    const eventTitle = lifecycleLab.querySelector("[data-life-event-title]");
    const eventDetail = lifecycleLab.querySelector("[data-life-event-detail]");
    const eventWhere = lifecycleLab.querySelector("[data-life-event-where]");
    const eventData = lifecycleLab.querySelector("[data-life-event-data]");
    const eventCrossing = lifecycleLab.querySelector("[data-life-event-crossing]");
    const stepList = lifecycleLab.querySelector("[data-lifecycle-steps]");

    const stop = () => {
        if (timer !== null) window.clearInterval(timer);
        timer = null;
        playIcon.textContent = "▶";
        playLabel.textContent = "Play run";
    };

    const renderStepButtons = () => {
        stepList.replaceChildren();
        timelines[mode].forEach((step, stepIndex) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = pad(stepIndex + 1);
            button.setAttribute("aria-label", `Event ${stepIndex + 1}: ${step.title}`);
            if (stepIndex === index) button.setAttribute("aria-current", "step");
            button.addEventListener("click", () => {
                stop();
                index = stepIndex;
                render();
            });
            stepList.append(button);
        });
    };

    const render = () => {
        const steps = timelines[mode];
        const step = steps[index];
        maps.forEach((map) => {
            map.hidden = map.dataset.lifecycleMap !== mode;
            selectAll("[data-life-node]", map).forEach((node) => {
                node.classList.remove("is-executing", "is-data", "is-crossing");
            });
        });
        const map = maps.find((candidate) => candidate.dataset.lifecycleMap === mode);
        step.executing.forEach((name) => {
            map.querySelector(`[data-life-node="${name}"]`)?.classList.add("is-executing");
        });
        step.resident.forEach((name) => {
            map.querySelector(`[data-life-node="${name}"]`)?.classList.add("is-data");
        });
        step.crossingNodes.forEach((name) => {
            map.querySelector(`[data-life-node="${name}"]`)?.classList.add("is-crossing");
        });
        count.textContent = `${pad(index + 1)} / ${pad(steps.length)}`;
        progress.style.width = `${((index + 1) / steps.length) * 100}%`;
        eventIndex.textContent = pad(index + 1);
        eventStatus.textContent = step.status;
        eventTitle.textContent = step.title;
        eventDetail.textContent = step.detail;
        eventWhere.textContent = step.where;
        eventData.textContent = step.data;
        eventCrossing.textContent = step.crossing;
        renderStepButtons();
    };

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            stop();
            mode = button.dataset.lifecycleMode;
            index = 0;
            setPressed(modeButtons, button);
            render();
        });
    });
    previous.addEventListener("click", () => {
        stop();
        const length = timelines[mode].length;
        index = (index - 1 + length) % length;
        render();
    });
    next.addEventListener("click", () => {
        stop();
        index = (index + 1) % timelines[mode].length;
        render();
    });
    play.addEventListener("click", () => {
        if (timer !== null) {
            stop();
            return;
        }
        if (index === timelines[mode].length - 1) {
            index = 0;
            render();
        }
        playIcon.textContent = "Ⅱ";
        playLabel.textContent = "Pause run";
        timer = window.setInterval(() => {
            const length = timelines[mode].length;
            if (index === length - 1) {
                stop();
                return;
            }
            index += 1;
            render();
        }, 1500);
    });
    render();
}

/* Scheduler laboratory */

const schedulerLab = document.querySelector("[data-scheduler-lab]");

if (schedulerLab) {
    let mode = "blocking";
    const modeButtons = selectAll("[data-scheduler-mode]", schedulerLab);
    const workerInput = schedulerLab.querySelector("[data-worker-input]");
    const workerOutput = schedulerLab.querySelector("[data-worker-output]");
    const quantumInput = schedulerLab.querySelector("[data-quantum-input]");
    const quantumOutput = schedulerLab.querySelector("[data-quantum-output]");
    const axis = schedulerLab.querySelector("[data-schedule-axis]");
    const grid = schedulerLab.querySelector("[data-schedule-grid]");
    const totalMetric = schedulerLab.querySelector("[data-schedule-total]");
    const pollMetric = schedulerLab.querySelector("[data-schedule-poll]");
    const blockedMetric = schedulerLab.querySelector("[data-schedule-blocked]");
    const firstCMetric = schedulerLab.querySelector("[data-schedule-first-c]");
    const title = schedulerLab.querySelector("[data-schedule-title]");
    const detail = schedulerLab.querySelector("[data-schedule-detail]");

    const workload = [
        { id: "A", segments: [{ type: "cpu", duration: 10 }, { type: "io", duration: 6 }, { type: "cpu", duration: 4 }] },
        { id: "B", segments: [{ type: "cpu", duration: 14 }] },
        { id: "C", segments: [{ type: "cpu", duration: 2 }, { type: "io", duration: 5 }, { type: "cpu", duration: 2 }] },
    ];

    const simulate = (selectedMode, requestedWorkers, quantum) => {
        const workerCount = selectedMode === "blocking" ? 1 : requestedWorkers;
        const tasks = workload.map((source) => ({
            id: source.id,
            segments: source.segments.map((segment) => ({ ...segment, remaining: segment.duration })),
            segment: 0,
            state: "ready",
            waitRemaining: 0,
        }));
        const ready = [...tasks];
        const workers = Array.from({ length: workerCount }, () => ({ task: null, slice: quantum }));
        const rows = workers.map(() => []);
        let tick = 0;

        const allDone = () => tasks.every((task) => task.state === "done");
        const advanceAfterCpu = (task, worker) => {
            task.segment += 1;
            if (task.segment >= task.segments.length) {
                task.state = "done";
                worker.task = null;
                return;
            }
            const nextSegment = task.segments[task.segment];
            if (nextSegment.type === "io") {
                task.waitRemaining = nextSegment.remaining;
                if (selectedMode === "blocking") {
                    task.state = "blocked";
                } else {
                    task.state = "waiting";
                    worker.task = null;
                }
            }
        };

        while (!allDone() && tick < 100) {
            if (selectedMode !== "blocking") {
                tasks.filter((task) => task.state === "waiting").forEach((task) => {
                    task.waitRemaining -= 1;
                    if (task.waitRemaining <= 0) {
                        task.segment += 1;
                        if (task.segment >= task.segments.length) {
                            task.state = "done";
                        } else {
                            task.state = "ready";
                            ready.push(task);
                        }
                    }
                });
            }

            workers.forEach((worker) => {
                if (!worker.task) {
                    const nextTask = ready.shift();
                    if (nextTask) {
                        nextTask.state = "running";
                        worker.task = nextTask;
                        worker.slice = quantum;
                    }
                }
            });

            workers.forEach((worker, workerIndex) => {
                const task = worker.task;
                if (!task) {
                    rows[workerIndex].push("idle");
                    return;
                }
                if (task.state === "blocked") {
                    rows[workerIndex].push("blocked");
                    task.waitRemaining -= 1;
                    if (task.waitRemaining <= 0) {
                        task.segment += 1;
                        if (task.segment >= task.segments.length) {
                            task.state = "done";
                            worker.task = null;
                        } else {
                            task.state = "running";
                        }
                    }
                    return;
                }

                rows[workerIndex].push(task.id);
                const segment = task.segments[task.segment];
                segment.remaining -= 1;
                worker.slice -= 1;
                if (segment.remaining <= 0) {
                    advanceAfterCpu(task, worker);
                } else if (selectedMode === "sliced" && worker.slice <= 0) {
                    task.state = "ready";
                    ready.push(task);
                    worker.task = null;
                }
            });
            tick += 1;
        }

        return { rows, ticks: tick };
    };

    const longestBurst = (rows) => {
        let longest = 0;
        rows.forEach((row) => {
            let active = null;
            let length = 0;
            row.forEach((cell) => {
                if (["A", "B", "C"].includes(cell) && cell === active) {
                    length += 1;
                } else if (["A", "B", "C"].includes(cell)) {
                    active = cell;
                    length = 1;
                } else {
                    active = null;
                    length = 0;
                }
                longest = Math.max(longest, length);
            });
        });
        return longest;
    };

    const firstTick = (rows, task) => {
        let first = Infinity;
        rows.forEach((row) => {
            const index = row.indexOf(task);
            if (index >= 0) first = Math.min(first, index + 1);
        });
        return Number.isFinite(first) ? first : null;
    };

    const renderSchedule = () => {
        const workers = Number(workerInput.value);
        const quantum = Number(quantumInput.value);
        workerOutput.textContent = workers;
        quantumOutput.textContent = quantum;
        workerInput.disabled = mode === "blocking";
        quantumInput.disabled = mode !== "sliced";
        const schedule = simulate(mode, workers, quantum);

        axis.replaceChildren();
        for (let tick = 1; tick <= schedule.ticks; tick += 1) {
            const label = document.createElement("span");
            label.textContent = tick === 1 || tick % 5 === 0 ? tick : "·";
            axis.append(label);
        }

        grid.replaceChildren();
        schedule.rows.forEach((row, rowIndex) => {
            const rowElement = document.createElement("div");
            rowElement.className = "schedule-row";
            const rowLabel = document.createElement("div");
            rowLabel.className = "schedule-row-label";
            const small = document.createElement("span");
            small.textContent = mode === "blocking" ? "OS thread" : "Tokio OS worker";
            const strong = document.createElement("strong");
            strong.textContent = mode === "blocking" ? "main" : `worker ${rowIndex + 1}`;
            rowLabel.append(small, strong);
            const cells = document.createElement("div");
            cells.className = "schedule-cells";
            row.forEach((cell, tick) => {
                const cellElement = document.createElement("span");
                cellElement.className = `schedule-cell cell-${cell.toLowerCase()}`;
                cellElement.textContent = cell === "idle" ? "·" : cell === "blocked" ? "×" : cell;
                cellElement.title = `Tick ${tick + 1}: ${cell === "blocked" ? "thread blocked on I/O" : cell === "idle" ? "idle worker" : `Run ${cell} guest CPU`}`;
                cells.append(cellElement);
            });
            rowElement.append(rowLabel, cells);
            grid.append(rowElement);
        });

        const blocked = schedule.rows.flat().filter((cell) => cell === "blocked").length;
        totalMetric.textContent = `${schedule.ticks} ticks`;
        pollMetric.textContent = `${longestBurst(schedule.rows)} ticks`;
        blockedMetric.textContent = `${blocked} ticks`;
        firstCMetric.textContent = `tick ${firstTick(schedule.rows, "C") ?? "—"}`;

        if (mode === "blocking") {
            title.textContent = "Current shape: one stack owns the process";
            detail.textContent = "Runs are serialized. CPU work and I/O waits retain the only main execution thread; the deadline helper can interrupt a timed-out guest but cannot advance another run.";
        } else if (mode === "async") {
            title.textContent = "Async I/O frees workers; guest CPU can still monopolize one";
            detail.textContent = "Run A parks while its host request waits, so another task can use that worker. But each CPU segment stays inside one Future::poll until it completes because no guest yield interval exists.";
        } else {
            title.textContent = "Async I/O plus guest yields bounds executor occupancy";
            detail.textContent = `Waiting host calls park their tasks, and CPU-heavy guest futures rejoin the ready queue after roughly ${quantum} work units. A separate total fuel/deadline budget must still terminate infinite work.`;
        }
    };

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            mode = button.dataset.schedulerMode;
            setPressed(modeButtons, button);
            renderSchedule();
        });
    });
    workerInput.addEventListener("input", renderSchedule);
    quantumInput.addEventListener("input", renderSchedule);
    renderSchedule();
}
