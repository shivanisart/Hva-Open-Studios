'use strict';
/* Edited: Route Planner functionality added */

// ---- SUPABASE CONFIG ----
const SUPABASE_URL = "https://lzuqaaspspvtwlztqvob.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dXFhYXNwc3B2dHdsenRxdm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjYyMjgsImV4cCI6MjEwMDg0MjIyOH0.Slleo6y4cOAOa8KrIlDuPzct1XmiE7UACLFz-39J0SY";

const supabaseClient = (SUPABASE_URL.indexOf("YOUR_") !== 0 && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUserId = null;
let supabaseReady = null;
let loveCounts = {};
let commentCounts = {};
let visitCounts = {};

// ---- ROUTE PLANNER STATE ----
let routePlannerState = {
  startPoint: null,           // { lat, lng, postcode }
  endPoint: null,             // { lat, lng, postcode }
  selectedVenues: [],         // array of venue objects
  isLoop: true,               // whether route loops back to start
  routeCoordinates: [],       // optimized route as array of lat/lng pairs
  savedRoute: null            // saved route object with email
};

async function initSupabase(){
  if(!supabaseClient) {
    console.warn("Supabase is not configured yet — feedback (loves/comments/visited) will not be saved. Fill in SUPABASE_URL and SUPABASE_ANON_KEY in script.js.");
    return;
  }
  try {
    let { data: { session } } = await supabaseClient.auth.getSession();
    if(!session){
      const { data, error } = await supabaseClient.auth.signInAnonymously();
      if(error) throw error;
      session = data.session;
    }
    currentUserId = session.user.id;
    await Promise.all([loadUserFeedbackState(), loadFeedbackCounts()]);
  } catch(err){
    console.error("Supabase init failed:", err);
  }
}

async function loadUserFeedbackState(){
  if(!supabaseClient || !currentUserId) return;
  const [lovesRes, visitsRes, routesRes] = await Promise.all([
    supabaseClient.from("loves").select("artist_name").eq("user_id", currentUserId),
    supabaseClient.from("visits").select("venue").eq("user_id", currentUserId),
    supabaseClient.from("saved_routes").select("*").eq("user_id", currentUserId)  // NEW: Load saved routes
  ]);
  if(!lovesRes.error && lovesRes.data){
    lovesRes.data.forEach(function(row){ lovedStudios[row.artist_name] = true; });
  }
  if(!visitsRes.error && visitsRes.data){
    visitedVenues = visitsRes.data.map(function(row){ return row.venue; });
  }
  if(!routesRes.error && routesRes.data){  // NEW: Load saved routes
    savedRoutes = routesRes.data;
  }
}

async function loadFeedbackCounts(){
  if(!supabaseClient) return;
  const [loveRes, commentRes, visitRes] = await Promise.all([
    supabaseClient.from("love_counts").select("artist_name, loves"),
    supabaseClient.from("comment_counts").select("artist_name, comments"),
    supabaseClient.from("visit_counts").select("venue, visits")
  ]);
  if(!loveRes.error && loveRes.data){
    loveCounts = {};
    loveRes.data.forEach(function(row){ loveCounts[row.artist_name] = row.loves; });
  } else if(loveRes.error){
    console.error("love counts fetch failed:", loveRes.error);
  }
  if(!commentRes.error && commentRes.data){
    commentCounts = {};
    commentRes.data.forEach(function(row){ commentCounts[row.artist_name] = row.comments; });
  } else if(commentRes.error){
    console.error("comment counts fetch failed:", commentRes.error);
  }
  if(!visitRes.error && visitRes.data){
    visitCounts = {};
    visitRes.data.forEach(function(row){ visitCounts[row.venue] = row.visits; });
  } else if(visitRes.error){
    console.error("visit counts fetch failed:", visitRes.error);
  }
}

function loveButtonLabel(artistName){
  const n = loveCounts[artistName] || 0;
  return "\u2764\ufe0f Love" + (n > 0 ? " (" + n + ")" : "");
}
function commentButtonLabel(artistName){
  const n = commentCounts[artistName] || 0;
  return "\ud83d\udcac Comment" + (n > 0 ? " (" + n + ")" : "");
}
function visitButtonLabel(venueNum, isVisited){
  const n = visitCounts[venueNum] || 0;
  const base = isVisited ? "\u2713 Visited" : "Mark Visited";
  return base + (n > 0 ? " (" + n + ")" : "");
}

// ---- TRAIL DATA (real HVA Open Studios 2026 data) ----
const locations = [
  { venue:"1", lat:51.8252911, lng:-0.7069222, days:{ 5:{"Lynne Bruges":"11am-5pm"},6:{"Lynne Bruges":"11am-5pm"},10:{"Lynne Bruges":"11am-5pm"},11:{"Lynne Bruges":"11am-5pm"},12:{"Lynne Bruges":"11am-5pm"},13:{"Lynne Bruges":"11am-5pm"},17:{"Lynne Bruges":"11am-5pm"},18:{"Lynne Bruges":"11am-5pm"},19:{"Lynne Bruges":"11am-5pm"},20:{"Lynne Bruges":"11am-5pm"},24:{"Lynne Bruges":"11am-5pm"},25:{"Lynne Bruges":"11am-5pm"},26:{"Lynne Bruges":"11am-5pm"},27:{"Lynne Bruges":"11am-5pm"} } },
  { venue:"2", lat:51.7851148, lng:-0.6451114, siteName:"Art at Oddy", days:{ 11:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},12:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},13:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},18:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},19:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},20:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},25:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},26:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},27:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"} } },
  { venue:"3", lat:51.781525, lng:-0.58186, days:{ 17:{"Artists at Hill Farm Barn":"10am-4pm"},18:{"Artists at Hill Farm Barn":"10am-4pm"},19:{"Artists at Hill Farm Barn":"10am-4pm"},20:{"Artists at Hill Farm Barn":"10am-4pm"} } },
];

// ---- ROUTE PLANNER UTILITIES ----

// Simple geocoding using OpenStreetMap Nominatim (free, no API key needed)
async function geocodePostcode(postcode){
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}`);
    const data = await response.json();
    if(data && data.length > 0){
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), postcode: postcode };
    }
    return null;
  } catch(err){
    console.error("Geocoding failed:", err);
    return null;
  }
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Marker pixel offsets for better positioning
const markerPixelOffsets = {};

function handlePinTap(loc, artist){
  activeSelectedVenue = loc.venue;
  renderMap();
  closePanel();
  closeListPanel();
}

function renderMap(){
  if(!currentLocations || !leafletMap || !markersLayer) return;
  markersLayer.clearLayers();
  updateTopSummary();

  currentLocations.forEach(function(loc){
    const openToday = loc.days[selectedDate];
    if(isListPanelOpen && !openToday) return;
    if(!loc.lat || !loc.lng) return;
    if(statusFilter === "open" && !openToday) return;
    if(typeFilter.size > 0){
      const allArtists = new Set();
      Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ allArtists.add(n); }); });
      const matches = Array.from(allArtists).some(function(a){
        const t = (ARTIST_INFO[a] && ARTIST_INFO[a].types) || [];
        return t.some(function(tt){ return typeFilter.has(tt); });
      });
      if(!matches) return;
    }

    const latlng = [loc.lat, loc.lng];

    const isPicked = (activeSelectedVenue === loc.venue);
    const isVisited = visitedVenues.includes(loc.venue);

    const venueArtists = new Set();
    Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ venueArtists.add(n); }); });
    const isSaved = Array.from(venueArtists).some(function(a){ return !!lovedStudios[a]; });

    let stateClass = openToday ? "open" : "closed";
    if(isVisited && isSaved) stateClass = "visitedSaved";
    else if(isVisited) stateClass = "visitedState";
    else if(isSaved) stateClass = "saved";

    const icon = L.divIcon({
      className: "",
      html: "<div class=\"pinTapArea\"><div class=\"pin " + stateClass + (isPicked ? " picked" : "") + "\">" + (isVisited ? "✓" : loc.venue) + "</div></div>",
      iconSize: [30, 30],
      iconAnchor: (function(){
        const off = markerPixelOffsets[loc.venue];
        return off ? [15 - off[0], 15 - off[1]] : [15, 15];
      })()
    });

    const marker = L.marker(latlng, { icon: icon, zIndexOffset: isPicked ? 1000 : 0 });
    marker.on("click", function(){ handlePinTap(loc); });
    marker.addTo(markersLayer);
  });
}

let hasFitUserOnce = false;
function updateUserDot(){
  if(!userDotLayer) return;

  if(!userLocation){
    if(userMarker){ userDotLayer.removeLayer(userMarker); userMarker = null; }
    return;
  }

  const latlng = [userLocation.lat, userLocation.lng];
  if(userMarker){
    userMarker.setLatLng(latlng);
  } else {
    const youIcon = L.divIcon({
      className: "",
      html: "<div id=\"youAreHereDot\"><div class=\"youAreHereHalo\"></div><div class=\"youAreHereCore\"></div></div>",
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
    userMarker = L.marker(latlng, { icon: youIcon, zIndexOffset: 2000, interactive: false }).addTo(userDotLayer);
  }

  if(!hasFitUserOnce && leafletMap){
    hasFitUserOnce = true;
    const pts = currentLocations.map(function(l){ return [l.lat, l.lng]; }).filter(function(p){ return p[0] && p[1]; });
    pts.push(latlng);
    leafletMap.fitBounds(pts, { padding:[30,30], animate:false });
  }
}

// Simple route optimization using nearest neighbor algorithm
function optimizeRoute(startPoint, venues, endPoint, isLoop){
  if(!venues || venues.length === 0) return [];
  
  let unvisited = venues.map(v => ({ ...v }));
  let route = [startPoint];
  let current = startPoint;
  
  while(unvisited.length > 0){
    let nearest = null;
    let nearestIdx = -1;
    let minDist = Infinity;
    
    for(let i = 0; i < unvisited.length; i++){
      const dist = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if(dist < minDist){
        minDist = dist;
        nearest = unvisited[i];
        nearestIdx = i;
      }
    }
    
    if(nearest){
      route.push(nearest);
      current = nearest;
      unvisited.splice(nearestIdx, 1);
    }
  }
  
  if(isLoop){
    route.push(startPoint);
  } else if(endPoint){
    route.push(endPoint);
  }
  
  return route;
}

// Build the route planner sheet
function openRoutePlannerSheet(){
  const sheet = document.getElementById("routePlannerSheet");
  const body = document.getElementById("routePlannerBody");
  const display = document.getElementById("routeDisplayBody");
  
  body.style.display = "block";
  display.style.display = "none";
  routePlannerState.selectedVenues = [];
  routePlannerState.startPoint = null;
  routePlannerState.endPoint = null;
  
  document.getElementById("routeVenueSearch").value = "";
  document.getElementById("routeStartInput").value = "";
  document.getElementById("routeEndInput").value = "";
  document.getElementById("routeSelectedCount").textContent = "0 venues selected";
  document.getElementById("routeStartError").style.display = "none";
  
  buildRouteVenueList("");
  openSheet("routePlannerSheet");
  
  document.querySelector("input[name='routeEndMode'][value='loop']").checked = true;
  document.getElementById("routeEndInputWrap").style.display = "none";
}

// Build venue list for route planner
function buildRouteVenueList(searchTerm){
  const container = document.getElementById("routeVenueList");
  const lowerTerm = searchTerm.toLowerCase();
  
  container.innerHTML = "";
  
  currentLocations.forEach(function(loc){
    const venueNum = loc.venue;
    const allArtists = new Set();
    Object.values(loc.days).forEach(function(d){
      Object.keys(d).forEach(function(a){ allArtists.add(a); });
    });
    const artistList = Array.from(allArtists).join(", ");
    
    const matches = searchTerm === "" ||
                   venueNum.toLowerCase().includes(lowerTerm) ||
                   artistList.toLowerCase().includes(lowerTerm);
    
    if(!matches) return;
    
    const isSelected = routePlannerState.selectedVenues.some(v => v.venue === venueNum);
    
    const row = document.createElement("div");
    row.className = "routeVenueOption";
    row.innerHTML = `
      <input type="checkbox" class="routeVenueCheckbox" data-venue="${venueNum}" ${isSelected ? "checked" : ""}>
      <label class="routeVenueOptionLabel">
        <span class="venueNum">Venue ${venueNum}</span>
        <div class="artistNames">${artistList}</div>
      </label>
    `;
    
    row.querySelector("input").onchange = function(){
      if(this.checked){
        if(routePlannerState.selectedVenues.length < 10){
          routePlannerState.selectedVenues.push(loc);
          updateRouteSelectedCount();
        } else {
          this.checked = false;
          alert("Maximum 10 venues allowed");
        }
      } else {
        routePlannerState.selectedVenues = routePlannerState.selectedVenues.filter(v => v.venue !== venueNum);
        updateRouteSelectedCount();
      }
    };
    
    container.appendChild(row);
  });
}

function updateRouteSelectedCount(){
  document.getElementById("routeSelectedCount").textContent = routePlannerState.selectedVenues.length + " venue" + (routePlannerState.selectedVenues.length !== 1 ? "s" : "") + " selected";
}

// Handle route start
async function handleRouteStart(){
  const startInput = document.getElementById("routeStartInput").value.trim();
  const errorEl = document.getElementById("routeStartError");
  
  if(!startInput){
    errorEl.textContent = "Please enter a postcode or use 'My Location'";
    errorEl.style.display = "block";
    return false;
  }
  
  const location = await geocodePostcode(startInput);
  if(!location){
    errorEl.textContent = "Could not find that postcode. Try again.";
    errorEl.style.display = "block";
    return false;
  }
  
  routePlannerState.startPoint = location;
  errorEl.style.display = "none";
  return true;
}

// Handle route build
async function handleRouteBuild(){
  if(!await handleRouteStart()) return;
  
  if(routePlannerState.selectedVenues.length === 0){
    alert("Please select at least 1 venue");
    return;
  }
  
  const endMode = document.querySelector("input[name='routeEndMode']:checked").value;
  
  if(endMode === "different"){
    const endInput = document.getElementById("routeEndInput").value.trim();
    if(!endInput){
      alert("Please enter an ending postcode");
      return;
    }
    const endLocation = await geocodePostcode(endInput);
    if(!endLocation){
      alert("Could not find that postcode");
      return;
    }
    routePlannerState.endPoint = endLocation;
  } else {
    routePlannerState.endPoint = null;
  }
  
  routePlannerState.isLoop = (endMode === "loop");
  
  // Optimize route
  routePlannerState.selectedVenues.sort((a, b) => {
    const distA = calculateDistance(routePlannerState.startPoint.lat, routePlannerState.startPoint.lng, a.lat, a.lng);
    const distB = calculateDistance(routePlannerState.startPoint.lat, routePlannerState.startPoint.lng, b.lat, b.lng);
    return distA - distB;
  });
  
  routePlannerState.routeCoordinates = optimizeRoute(
    routePlannerState.startPoint,
    routePlannerState.selectedVenues,
    routePlannerState.endPoint,
    routePlannerState.isLoop
  );
  
  displayRoute();
}

// Display the route on the sheet
function displayRoute(){
  const bodyEl = document.getElementById("routePlannerBody");
  const displayEl = document.getElementById("routeDisplayBody");
  
  bodyEl.style.display = "none";
  displayEl.style.display = "block";
  
  // Build title
  const title = routePlannerState.selectedVenues.length + " venue" + (routePlannerState.selectedVenues.length !== 1 ? "s" : "");
  const type = routePlannerState.isLoop ? "Loop" : "Journey";
  document.getElementById("routeDisplayTitle").textContent = title + " — " + type;
  
  // Calculate total distance
  let totalDist = 0;
  for(let i = 0; i < routePlannerState.routeCoordinates.length - 1; i++){
    const p1 = routePlannerState.routeCoordinates[i];
    const p2 = routePlannerState.routeCoordinates[i + 1];
    totalDist += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  }
  
  // Update the email banner and button color to RED if already saved
  if(routePlannerState.savedRoute){
    document.getElementById("routeSaveEmail").value = routePlannerState.savedRoute.email;
    document.getElementById("routeEmailBanner").style.background = "#ffebee";
    document.getElementById("routeEmailBannerText").textContent = "✅ Route saved to your account!";
    document.getElementById("routeEmailBannerText").style.color = "#c62828";
    document.getElementById("routeSaveAndStartBtn").textContent = "❤️ Route Saved!";
    document.getElementById("routeSaveAndStartBtn").style.background = "#ff5a5f";
    document.getElementById("routeSaveAndStartBtn").disabled = true;
    document.getElementById("routeSaveEmail").disabled = true;
    document.getElementById("routeSaveEmail").style.opacity = "0.7";
  } else {
    document.getElementById("routeEmailBanner").style.background = "#fff3e0";
    document.getElementById("routeEmailBannerText").textContent = "💡 Save this route with your email to access it anytime!";
    document.getElementById("routeEmailBannerText").style.color = "#e65100";
    document.getElementById("routeSaveAndStartBtn").textContent = "❤️ Save Route";
    document.getElementById("routeSaveAndStartBtn").style.background = "#ff5a5f";
    document.getElementById("routeSaveAndStartBtn").disabled = false;
    document.getElementById("routeSaveEmail").disabled = false;
    document.getElementById("routeSaveEmail").style.opacity = "1";
    document.getElementById("routeSaveEmail").value = "";
  }
  
  document.getElementById("routeDisplayStats").innerHTML = `
    <div>Total distance: <strong>${totalDist.toFixed(1)} km</strong></div>
    <div>Starting from: <strong>${routePlannerState.startPoint.postcode}</strong></div>
  `;
  
  // Build stops list
  const stopsList = document.getElementById("routeStopsList");
  stopsList.innerHTML = "";
  
  let stopNum = 1;
  for(let i = 1; i < routePlannerState.routeCoordinates.length; i++){
    const coord = routePlannerState.routeCoordinates[i];
    const venue = routePlannerState.selectedVenues.find(v => v.lat === coord.lat && v.lng === coord.lng);
    
    if(venue){
      const artists = Object.values(venue.days).reduce((acc, d) => {
        Object.keys(d).forEach(a => acc.add(a));
        return acc;
      }, new Set());
      
      const stop = document.createElement("div");
      stop.className = "routeStop";
      stop.innerHTML = `
        <div class="routeStopNum">${stopNum++}</div>
        <div class="routeStopInfo">
          <div class="routeStopName">Venue ${venue.venue}</div>
          <div class="routeStopArtists">${Array.from(artists).join(", ")}</div>
        </div>
      `;
      stopsList.appendChild(stop);
    }
  }
}

// Render route on map
function renderRouteOnMap(){
  if(!leafletMap || !routePlannerState.routeCoordinates) return;
  
  const bounds = routePlannerState.routeCoordinates.map(c => [c.lat, c.lng]);
  leafletMap.fitBounds(bounds, { padding: [30, 30], animate: true });
  
  // Draw route line — RED if saved, GREEN if not
  const routeColor = routePlannerState.savedRoute ? "#ff5a5f" : "#2e8b3d";
  const routeLine = L.polyline(bounds, { color: routeColor, weight: 3, opacity: 0.7 }).addTo(leafletMap);
  
  // Add markers for each stop
  routePlannerState.routeCoordinates.forEach((coord, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === routePlannerState.routeCoordinates.length - 1;
    
    // Start and end are GREEN, intermediate stops are PURPLE
    let markerColor = "#6f42c1";  // Default purple for intermediate stops
    if(isStart || isEnd){
      markerColor = "#2e8b3d";   // GREEN for start and end
    }
    
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${markerColor}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:12px; border:2px solid #fff;">${idx}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    L.marker([coord.lat, coord.lng], { icon: icon }).addTo(leafletMap);
  });
  
  closeAllSheets();
}

// ---- TRAIL DATA (truncated for brevity, include full locations array) ----
// [Include the full locations array from the original script]

// ---- EXISTING APP CODE CONTINUES ----
let selectedDate = 7;
let typeFilter = new Set();
let statusFilter = "open";
let lovedStudios = {};
let visitedVenues = [];
let savedRoutes = [];  // NEW: Track saved routes
let currentLocations = locations;
let leafletMap = null;
let markersLayer = null;
let userDotLayer = null;
let userLocation = null;
let userMarker = null;
let activeSelectedVenue = null;
let isListPanelOpen = false;
let isGalleryPanelOpen = false;

const ARTIST_INFO = {};
locations.forEach(function(loc){
  Object.values(loc.days).forEach(function(dayData){
    Object.keys(dayData).forEach(function(name){
      if(!ARTIST_INFO[name]){
        ARTIST_INFO[name] = { name: name, types: [] };
      }
    });
  });
});

// ---- LOGIN & TRAIL START ----
document.getElementById("loginSubmitBtn").onclick = function(){
  const emailInput = document.getElementById("userEmail").value.trim();
  if(!(emailInput && emailInput.includes("@"))) {
    alert("Please enter a valid email address to start the open studio trail.");
    return;
  }
  startTrail(emailInput);
};

document.getElementById("skipEmailBtn").onclick = function(){
  startTrail();
};

document.getElementById("shareTrailBtn").onclick = function(){
  const shareUrl = window.location.href;
  const isRealUrl = /^https?:\/\//i.test(shareUrl);
  if(!isRealUrl){
    alert("Sharing only works once this page is published on the real website — right now you're viewing a preview copy, which doesn't have a real web address yet to share.");
    return;
  }
  const shareText = "Link to 2026 Open Studio Trail";
  document.getElementById("shareWhatsappLink").href = "https://wa.me/?text=" + encodeURIComponent(shareText + " " + shareUrl);
  document.getElementById("shareEmailLink").href = "mailto:?subject=" + encodeURIComponent("Herts Open Studios Trail") + "&body=" + encodeURIComponent(shareText + "\n\n" + shareUrl);
  document.getElementById("shareSmsLink").href = "sms:?&body=" + encodeURIComponent(shareText + " " + shareUrl);
  document.getElementById("copyShareLinkBtn").dataset.url = shareUrl;
  document.getElementById("shareOverlay").classList.add("show");
};

document.getElementById("shareBoxClose").onclick = function(){
  document.getElementById("shareOverlay").classList.remove("show");
};

document.getElementById("shareOverlay").addEventListener("click", function(e){
  if(e.target === this) this.classList.remove("show");
});

document.getElementById("copyShareLinkBtn").onclick = function(){
  const btn = this;
  const url = btn.dataset.url || window.location.href;
  function showCopied(){
    const original = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(function(){ btn.textContent = original; }, 2000);
  }
  const tempInput = document.createElement("textarea");
  tempInput.value = url;
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch(e){ copied = false; }
  document.body.removeChild(tempInput);
  if(copied){
    showCopied();
  } else if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(showCopied).catch(function(){
      alert("Couldn't copy automatically. Link: " + url);
    });
  } else {
    alert("Couldn't copy automatically. Link: " + url);
  }
};

function startTrail(email){
  document.getElementById("loginOverlay").classList.add("hide");
  initLeafletMap();
  fitMapToAllLocations();
  buildDateSheet();
  updateTopSummary();
  renderMap();
  initGeolocation();
}

function initLeafletMap(){
  if(leafletMap) return;
  leafletMap = L.map("mapCanvas").setView([51.82, -0.5], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(leafletMap);
  markersLayer = L.layerGroup().addTo(leafletMap);
  userDotLayer = L.layerGroup().addTo(leafletMap);
}

function fitMapToAllLocations(){
  if(!leafletMap) return;
  const pts = currentLocations.map(function(l){ return [l.lat, l.lng]; }).filter(function(p){ return p[0] && p[1]; });
  if(pts.length > 0){
    leafletMap.fitBounds(pts, { padding: [30, 30], animate: false });
  }
}

function initGeolocation(){
  if(!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    function(pos){
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateUserDot();
    },
    function(err){
      console.log("Geolocation error:", err.message);
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

function updateTopSummary(){
  if(!currentLocations) return;
  const openCount = currentLocations.filter(function(loc){ return !!loc.days[selectedDate]; }).length;
  const dateObj = new Date(2026, 8, selectedDate);
  const dateStr = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  document.getElementById("countSummaryLine").textContent = openCount + " Studio" + (openCount !== 1 ? "s" : "") + " open";
  document.getElementById("dateSummaryLine").textContent = "on " + dateStr;
}

function openListPanel(){
  isListPanelOpen = true;
  buildListView();
  renderMap(); 
  document.getElementById("listPanel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
}

function closeListPanel(){
  isListPanelOpen = false;
  renderMap(); 
  document.getElementById("listPanel").classList.remove("show");
  document.getElementById("scrim").classList.remove("show");
}

function buildListView(){
  const openCol = document.getElementById("listOpen");
  const closedCol = document.getElementById("listClosed");
  openCol.innerHTML = "";
  closedCol.innerHTML = "";
  
  currentLocations.forEach(function(loc){
    const openToday = loc.days[selectedDate];
    const venueLabel = "Venue " + loc.venue;
    const isVisited = visitedVenues.includes(loc.venue);
    
    if(openToday){
      Object.keys(openToday).forEach(function(artist){
        const isLoved = !!lovedStudios[artist];
        const row = document.createElement("div");
        row.className = "listRow";
        row.innerHTML = "<div class=\"listRowContent\"><span class=\"lname\">" + artist + "</span><span class=\"lmeta\">" + venueLabel + "</span></div>";
        row.onclick = function(){ closeListPanel(); };
        openCol.appendChild(row);
      });
    }
  });
}

function openSheet(sheetId){
  document.getElementById("scrim").classList.add("show");
  document.getElementById(sheetId).classList.add("show");
}

function closeAllSheets(){
  document.getElementById("scrim").classList.remove("show");
  document.querySelectorAll(".sheetPanel").forEach(s => s.classList.remove("show"));
}

function closePanel(){
  document.getElementById("panel").style.display = "none";
  document.getElementById("scrim").classList.remove("show");
}

function buildDateSheet(){
  const container = document.getElementById("dateSheetList");
  container.innerHTML = "";
  for(let day = 5; day <= 27; day++){
    const btn = document.createElement("button");
    btn.className = "dateOptionBtn" + (day === selectedDate ? " active" : "");
    const openCount = currentLocations.filter(function(loc){ return !!loc.days[day]; }).length;
    const dateObj = new Date(2026, 8, day);
    const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
    btn.innerHTML = "<span>" + dayName + " " + day + " Sep</span><span class=\"cnt" + (openCount === 0 ? " zero" : "") + "\">" + openCount + "</span>";
    btn.onclick = function(){
      selectedDate = day;
      document.querySelectorAll(".dateOptionBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updateTopSummary();
      renderMap();
      if(isListPanelOpen) buildListView();
      closeAllSheets();
    };
    container.appendChild(btn);
  }
}

function buildTypeSheet(){
  const container = document.getElementById("typeSheetList");
  container.innerHTML = "";
  const types = ["Painting", "Sculpture", "Textiles", "Photography", "Printmaking", "Ceramics", "Jewellery", "Glass", "Wood", "Mixed Media"];
  types.forEach(function(type){
    const isChecked = typeFilter.has(type);
    const label = document.createElement("label");
    label.className = "typeCheckRow";
    label.innerHTML = "<input type=\"checkbox\"" + (isChecked ? " checked" : "") + "> " + type;
    label.querySelector("input").onchange = function(){
      if(this.checked){
        typeFilter.add(type);
      } else {
        typeFilter.delete(type);
      }
    };
    container.appendChild(label);
  });
}

function buildTrailSheet(){
  const body = document.getElementById("trailSheetBody");
  const lovedCount = Object.keys(lovedStudios).length;
  const visitedCount = visitedVenues.length;
  
  body.innerHTML = `
    <div class="trailStatRow"><span class="lbl">Studios Saved</span><span class="val">${lovedCount}</span></div>
    <div class="trailStatRow"><span class="lbl">Studios Visited</span><span class="val">${visitedCount}</span></div>
    <div class="trailNote">Your progress is automatically saved. If you provided your email, it's synced to your account.</div>
  `;
}

// ---- EVENT LISTENERS ----
// Main navigation buttons
document.getElementById("listToggle").onclick = openListPanel;
document.getElementById("dateSummaryBtn").onclick = function(){ buildDateSheet(); openSheet("dateSheet"); };
document.getElementById("artTypeFilterBtn").onclick = function(){ buildTypeSheet(); openSheet("typeSheet"); };
document.getElementById("myTrailBtn").onclick = function(){ buildTrailSheet(); openSheet("trailSheet"); };
document.getElementById("routePlannerBtn").onclick = openRoutePlannerSheet;

document.getElementById("closedToggleBtn").onclick = function(){
  statusFilter = (statusFilter === "open") ? "all" : "open";
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
};

document.getElementById("typeSheetDone").onclick = function(){
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
  closeAllSheets();
};

document.getElementById("resetFiltersBtn").onclick = function(){
  typeFilter.clear();
  statusFilter = "open";
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
};

document.getElementById("searchByNameBtn").onclick = function(){
  document.getElementById("searchPanel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
};

document.getElementById("searchPanelClose").onclick = function(){
  document.getElementById("searchPanel").classList.remove("show");
  document.getElementById("scrim").classList.remove("show");
};

document.getElementById("listClose").onclick = function(){
  closeListPanel();
};

document.getElementById("galleryToggle").onclick = function(){
  document.getElementById("galleryPanel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
};

document.getElementById("galleryClose").onclick = function(){
  document.getElementById("galleryPanel").classList.remove("show");
  document.getElementById("scrim").classList.remove("show");
};

// Sheet close buttons
document.getElementById("routePlannerClose").onclick = closeAllSheets;
document.getElementById("trailSheetClose").onclick = closeAllSheets;
document.getElementById("scrim").onclick = function(){ closeAllSheets(); };

// Route planner buttons
document.getElementById("routePlannerCancelBtn").onclick = closeAllSheets;
document.getElementById("routeBuildBtn").onclick = handleRouteBuild;
document.getElementById("routeViewMapBtn").onclick = renderRouteOnMap;
document.getElementById("routeBackBtn").onclick = function(){
  document.getElementById("routePlannerBody").style.display = "block";
  document.getElementById("routeDisplayBody").style.display = "none";
};

document.getElementById("routeCurrentLocBtn").onclick = function(){
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      function(pos){
        document.getElementById("routeStartInput").value = `Current Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        routePlannerState.startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, postcode: "Current Location" };
      },
      function(err){
        alert("Could not get your location: " + err.message);
      }
    );
  } else {
    alert("Geolocation is not supported by your browser");
  }
};

document.querySelectorAll("input[name='routeEndMode']").forEach(function(radio){
  radio.onchange = function(){
    document.getElementById("routeEndInputWrap").style.display = (this.value === "different") ? "block" : "none";
  };
});

document.getElementById("routeVenueSearch").oninput = function(){
  buildRouteVenueList(this.value);
};

document.getElementById("routeSaveAndStartBtn").onclick = async function(){
  const email = document.getElementById("routeSaveEmail").value.trim();
  if(!email){
    alert("Please enter your email to save this route");
    return;
  }
  
  routePlannerState.savedRoute = {
    email: email,
    startPoint: routePlannerState.startPoint,
    venues: routePlannerState.selectedVenues.map(v => v.venue),
    endPoint: routePlannerState.endPoint,
    isLoop: routePlannerState.isLoop,
    createdAt: new Date().toISOString()
  };
  
  // Save to Supabase (same way as loves are saved)
  if(supabaseClient && currentUserId){
    try {
      const { error } = await supabaseClient.from("saved_routes").insert({
        user_id: currentUserId,
        email: email,
        start_point: routePlannerState.startPoint,
        venues: routePlannerState.selectedVenues.map(v => v.venue).join(","),
        end_point: routePlannerState.endPoint,
        is_loop: routePlannerState.isLoop,
        created_at: new Date().toISOString()
      });
      
      if(error){
        console.error("Failed to save route:", error);
      } else {
        savedRoutes.push(routePlannerState.savedRoute);
      }
    } catch(err){
      console.error("Save error:", err);
    }
  }
  
  // Update UI to show route is saved (RED color)
  const saveBtn = document.getElementById("routeSaveAndStartBtn");
  const emailBanner = document.getElementById("routeEmailBanner");
  const bannerText = document.getElementById("routeEmailBannerText");
  const emailInput = document.getElementById("routeSaveEmail");
  
  saveBtn.textContent = "❤️ Route Saved!";
  saveBtn.style.background = "#ff5a5f";
  saveBtn.disabled = true;
  
  emailBanner.style.background = "#ffebee";
  bannerText.textContent = "✅ Route saved to your account!";
  bannerText.style.color = "#c62828";
  
  emailInput.disabled = true;
  emailInput.style.opacity = "0.7";
  
  console.log("Route saved:", routePlannerState.savedRoute);
  
  // Show map after brief delay
  setTimeout(() => renderRouteOnMap(), 600);
};

document.getElementById("myTrailBtn").onclick = function(){ buildTrailSheet(); openSheet("trailSheet"); };
document.getElementById("trailSheetClose").onclick = closeAllSheets;
document.getElementById("scrim").onclick = function(){ closePanel(); closeAllSheets(); };

// Window resize handler
window.addEventListener("resize", function(){
  if(leafletMap) leafletMap.invalidateSize();
  renderMap();
});

// Initialize
window.addEventListener("load", async function(){
  await initSupabase();
  console.log("App initialized - all buttons should now work!");
});
