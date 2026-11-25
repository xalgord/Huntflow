<script lang="ts">
  import { page } from '$app/stores';
  import RouteRedirect from '$lib/components/layout/RouteRedirect.svelte';
</script>

<!-- Coverage checklists are now the program's Checklists tab. -->
<RouteRedirect to={`/programs/${$page.params.id}#checklists`} label="the program's checklists" />
