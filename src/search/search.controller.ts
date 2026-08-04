import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller({
  path: 'search',
  version: '1',
})
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('waybills')
  @ApiOperation({
    summary: 'Search waybills in Elasticsearch',
    description:
      'Performs full-text search across waybill numbers, addresses, and package descriptions.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search query string',
  })
  @ApiResponse({ status: 200, description: 'Matching waybills list returned.' })
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
