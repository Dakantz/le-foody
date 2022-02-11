<template>
  <v-app>
    <v-app-bar app>
      <div class="d-flex align-center">Le Foody restaurant aggeragator</div>

      <v-spacer></v-spacer>

      <v-btn href="https://twitter.com/dakantz" target="_blank" text>
        <span class="mr-2">@dakantz</span>
        <v-icon>mdi-open-in-new</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <filters v-model="filters" />
      <results-map
        :results="results"
        :loading="loading"
        :total="total"
        :distance="filters ? filters.distance : 0"
        :zoom_to="zoom_to"
      />
      <result-list
        :results="results"
        :loading="loading"
        :total="total"
        @loadNext="loadNextPage"
        @openInMap="openInMap"
      />
    </v-main>
  </v-app>
</template>

<script>
import axios from "axios";
import Filters from "./components/Filters.vue";
import ResultList from "./components/ResultList.vue";
import ResultsMap from "./components/ResultsMap.vue";
export default {
  name: "App",

  components: { Filters, ResultList, ResultsMap },

  data: () => ({
    filters: null,
    results: [],
    loading: false,
    currentCoords: {
      lat: 0,
      lng: 0,
    },
    skip: 0,
    limit: 50,
    total: 0,
    latest_id: 0,
    zoom_to: null,
  }),
  watch: {
    async filters() {
      console.log("Filters changed to ", this.filters);
      this.loadNextPage(true);
    },
  },
  methods: {
    async loadNextPage(inital = false) {
      const local_id = ++this.latest_id;
      if (inital) {
        this.skip = 0;
        this.zoom_to = null;
        this.results = [];
      }
      this.loading = true;
      try {
        let query = this.filters || {};
        if (query.location && query.location.is_gps) {
          query.location = { ...this.currentCoords, ...query.location };
        }
        if (query.weigths) {
          query.falstaff_weight = query.weigths.find(
            (f) => f.name == "falstaff"
          ).value;
          query.google_weight = query.weigths.find(
            (f) => f.name == "google"
          ).value;
          query.tripadvisor_weight = query.weigths.find(
            (f) => f.name == "tripadvisor"
          ).value;
        }
        console.log(query.location);
        if (query.location) {
          query.location = {
            distance: query.distance,
            lat: query.location.lat,
            lng: query.location.lng,
          };
        }
        const api_base = process.env.VUE_APP_API || "http://localhost:8123";
        let data = await axios.post(api_base + "/restaurants", {
          ...query,
          skip: this.skip,
          limit: this.limit,
        });
        if (local_id != this.latest_id) {
          this.loading = false;
          return;
        }
        console.log(data);
        this.total = data.data.total;
        this.results.push(...data.data.results);
        this.skip += data.data.results.length;
      } catch (error) {
        console.error("Failed to load results!", error);
      }
      this.loading = false;
    },
    geolocator(location) {
      this.currentCoords.lat = location.coords.latitude;
      this.currentCoords.lng = location.coords.longitude;
    },
    openInMap(target) {
      this.zoom_to = target;
    },
  },
  created() {
    if (navigator) {
      navigator.geolocation.watchPosition(this.geolocator);
    }
    this.loadNextPage();
  },
};
</script>
