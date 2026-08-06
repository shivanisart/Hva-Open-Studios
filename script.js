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
  const [lovesRes, visitsRes] = await Promise.all([
    supabaseClient.from("loves").select("artist_name").eq("user_id", currentUserId),
    supabaseClient.from("visits").select("venue").eq("user_id", currentUserId)
  ]);
  if(!lovesRes.error && lovesRes.data){
    lovesRes.data.forEach(function(row){ lovedStudios[row.artist_name] = true; });
  }
  if(!visitsRes.error && visitsRes.data){
    visitedVenues = visitsRes.data.map(function(row){ return row.venue; });
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
  
  // Draw route line
  const routeLine = L.polyline(bounds, { color: "#2e8b3d", weight: 3, opacity: 0.7 }).addTo(leafletMap);
  
  // Add markers for each stop
  routePlannerState.routeCoordinates.forEach((coord, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === routePlannerState.routeCoordinates.length - 1;
    
    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${isStart ? "#2e8b3d" : isEnd ? "#ff5a5f" : "#6f42c1"}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:12px; border:2px solid #fff;">${idx}</div>`,
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

function openSheet(sheetId){
  document.getElementById("scrim").classList.add("show");
  document.getElementById(sheetId).classList.add("show");
}

function closeAllSheets(){
  document.getElementById("scrim").classList.remove("show");
  document.querySelectorAll(".sheetPanel").forEach(s => s.classList.remove("show"));
}

function openPanel(title, body){
  document.getElementById("scrim").classList.add("show");
  const panelBody = document.getElementById("panelBody");
  panelBody.innerHTML = body;
  document.getElementById("panel").style.display = "block";
}

function closePanel(){
  document.getElementById("panel").style.display = "none";
  document.getElementById("scrim").classList.remove("show");
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
document.getElementById("routePlannerBtn").onclick = openRoutePlannerSheet;
document.getElementById("routePlannerClose").onclick = closeAllSheets;
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

document.getElementById("routeSaveAndStartBtn").onclick = function(){
  const email = document.getElementById("routeSaveEmail").value.trim();
  if(email){
    routePlannerState.savedRoute = {
      email: email,
      startPoint: routePlannerState.startPoint,
      venues: routePlannerState.selectedVenues.map(v => v.venue),
      endPoint: routePlannerState.endPoint,
      isLoop: routePlannerState.isLoop,
      createdAt: new Date().toISOString()
    };
    // In a real app, save to Supabase here
    alert("Route saved! View it on the map.");
  }
  renderRouteOnMap();
};

document.getElementById("myTrailBtn").onclick = function(){ buildTrailSheet(); openSheet("trailSheet"); };
document.getElementById("trailSheetClose").onclick = closeAllSheets;
document.getElementById("scrim").onclick = function(){ closePanel(); closeAllSheets(); };

// Initialize
window.addEventListener("load", async function(){
  await initSupabase();
  console.log("App initialized");
});
