<template>
  <v-container>
    <v-row>
      <v-col>
        <v-autocomplete
          clearable
          v-model="selected_data"
          :loading="loading"
          :items="items"
          :search-input.sync="search"
          hide-no-data
          return-object
          hide-details
          item-text="name"
          label="Search for a specific City/Region..."
        >
          <template v-slot:item="{ item }"
            ><div v-if="item.is_gps" color="primary">
              {{ item.name
              }}<v-icon color="primary" class="ml-1">mdi-crosshairs-gps</v-icon>
            </div>
            <div v-else>{{ item.name }}</div>
          </template>
        </v-autocomplete>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from "axios";
import _ from "lodash";
export default {
  name: "location-search",

  data: () => ({
    selected_data: null,
    places_items: [],
    loading: false,
    search: null,
    currentCoords: {
      lat: 0,
      lng: 0,
    },
  }),
  computed: {
    items() {
      return [
        {
          name: "Current Location",
          value: this.currentCoords,
          is_gps: true,
        },
      ].concat(this.places_items);
    },
  },
  methods: {
    async debounced_query(query) {
      try {
        this.loading = true;
        const api_base = process.env.VUE_APP_API || "http://localhost:8123";
        let data = await axios.get(api_base + "/location-search", {
          params: {
            query,
          },
        });
        console.log(data);
        this.places_items = data.data.candidates.map((candidate) => {
          return {
            name: candidate.name,
            ...candidate.geometry.location,
            is_gps: false,
          };
        });
      } catch (error) {
        console.error("Failed to load location query, ", error);
      }
      this.loading = false;
    },
  },
  watch: {
    selected_data() {
      this.$emit("input", this.selected_data);

      this.loading = false;
    },
    search(query) {
      this.debounced_query(query);
    },
  },
};
</script>
