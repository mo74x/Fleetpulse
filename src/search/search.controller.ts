import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller({
  path: 'search',
  version: '1',
})
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('waybills')
  async searchWaybills(@Query('q') query: string) {
    if (!query) {
      return [];
    }
    const results = await this.searchService.searchWaybills(query);
    return {
      count: results.length,
      data: results,
    };
  }
}
