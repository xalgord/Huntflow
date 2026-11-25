<script lang="ts">
  import { page } from '$app/stores';
  import RouteRedirect from '$lib/components/layout/RouteRedirect.svelte';
</script>

<!-- Program details moved to /programs/:id. -->
<RouteRedirect to={`/programs/${$page.params.id}`} label="the program" />
