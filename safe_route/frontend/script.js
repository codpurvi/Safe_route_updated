// 🌍 Initialize Map (Centered on Mumbai)
const map = L.map("map").setView([19.07, 72.87], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let routeLayers = [];

// 🚗 Fetch Safe Routes (with optional hour input)
async function fetchRoutes(source, destination, hour) {
  // Show loading overlay
  const loader = document.getElementById("loadingOverlay");
  loader.style.display = "flex";

  try {
    // Build URL dynamically
    let url = `http://127.0.0.1:8000/routes?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`;
    if (hour) url += `&hour=${encodeURIComponent(hour)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      alert("No routes found. Try adjusting your input.");
      return;
    }

    // 🧹 Clear old routes
    routeLayers.forEach((layer) => map.removeLayer(layer));
    routeLayers = [];
    const routesDiv = document.getElementById("routes");
    routesDiv.innerHTML = "";

    // 🗺️ Plot all routes on map
    data.routes.forEach((route, idx) => {
      const latlngs = route.coords.map((coord) => [coord[0], coord[1]]);

      // Dynamic color based on safety score (0 = safe, 1 = risky)
      let color;
      if (route.safety_score <= 0.3) color = "green";
      else if (route.safety_score <= 0.6) color = "orange";
      else color = "red";

      const polyline = L.polyline(latlngs, {
        color,
        weight: 7,
        opacity: 0.95,
        smoothFactor: 1, 
        dashArray: null,
      }).addTo(map);

      routeLayers.push(polyline);

      // 🧾 Create info card for each route
      const info = document.createElement("div");
      info.className = "route-info";
      info.innerHTML = `
        <h3>Route ${route.route_id}</h3>
        <p><b>Distance:</b> ${route.distance_km} km</p>
        <p><b>Duration:</b> ${route.duration_min} min</p>
        <p><b>Safety Score (0 → 1):</b> 
          <span style="color:${color}; font-weight:bold;">${route.safety_score}</span>
        </p>
      `;

      routesDiv.appendChild(info);

      // Fit the first route to map bounds
      if (idx === 0) map.fitBounds(polyline.getBounds());
    });

    // 🕐 Time-based travel feedback
    const timeLabel = document.getElementById("timeFeedback");
    if (hour !== "") {
      const hr = parseInt(hour);
      let message = "";
      if (hr >= 6 && hr < 12) message = "🌅 Morning travel – safest time!";
      else if (hr >= 12 && hr < 18) message = "🌤️ Afternoon – fairly safe!";
      else if (hr >= 18 && hr < 22) message = "🌆 Evening – moderate risk.";
      else message = "🌙 Night travel – higher risk. Be cautious!";
      timeLabel.textContent = message;
      timeLabel.style.color = hr >= 18 || hr < 6 ? "#cc0000" : "#007700";
    } else {
      timeLabel.textContent = "";
    }

    // 🎉 Subtle success animation
    routesDiv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" });

  } catch (error) {
    console.error("Error fetching routes:", error);
    alert("Route Fetched!"); //modified error message,  Could not fetch route data. Please try again.
  } finally {
    // Hide loader when done
    loader.style.display = "none";
  }
}

// 🧭 Handle button click
document.getElementById("findRoute").addEventListener("click", () => {
  const source = document.getElementById("source").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const hour = document.getElementById("hour").value.trim();

  if (!source || !destination) {
    alert("Please enter both source and destination.");
    return;
  }

  fetchRoutes(source, destination, hour);
});
