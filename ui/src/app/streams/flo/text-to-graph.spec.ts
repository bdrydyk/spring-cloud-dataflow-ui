import { Flo } from 'spring-flo';
import { convertTextToGraph } from './text-to-graph';
import { convertParseResponseToJsonGraph } from './text-to-graph';
import { JsonGraph } from './text-to-graph';
import { Parser } from '../../shared/services/parser';

describe('text-to-graph', () => {

    let parseResult: Parser.ParseResult;
    let graph: JsonGraph.Graph;
    let node: JsonGraph.Node;
    let link: JsonGraph.Link;

    let fakemetamodel: Map<string, Map<string, Flo.ElementMetadata>>;

    beforeAll(() => {
        const fakeTimeMetadata: Flo.ElementMetadata = {
            'group': 'fake',
            'name': 'time',
            get(property: String): Promise<Flo.PropertyMetadata> {
                return Promise.resolve(null);
            },
            properties(): Promise<Map<string, Flo.PropertyMetadata>> {
                return Promise.resolve(new Map());
            }
        };
        const fakeTime: Map<string, Flo.ElementMetadata> = new Map();
        fakeTime['time'] = fakeTimeMetadata;
        fakemetamodel = new Map();
        fakemetamodel['fake'] = fakeTime;
    });

  // First set of tests don't require a fake Flo - they convert DSL to a JSON graph (not a jointjs graph)

  it('jsongraph: nograph', () => {
    const dsl = '';
    parseResult = Parser.parse(dsl, 'stream');
    const holder: JsonGraph.GraphHolder = convertParseResponseToJsonGraph(dsl, parseResult);
    expect(holder.errors.length).toEqual(0);
    expect(holder.graph).toBeNull();
  });

  it('jsongraph: error - no more data', () => {
    const dsl = 'time | ';
    parseResult = Parser.parse(dsl, 'stream');
    const holder: JsonGraph.GraphHolder = convertParseResponseToJsonGraph(dsl, parseResult);
    expect(holder.errors[0].message).toEqual('Out of data');
  });

  it('jsongraph: two streams sharing a destination', () => {
      graph = getGraph('time > :abc\nfile > :abc');
      expect(graph.streamdefs[0].def).toEqual('time  > :abc');
      expect(graph.streamdefs[1].def).toEqual('file  > :abc');
      expect(graph.nodes[0].name).toEqual('time');
      expect(graph.nodes[0]['stream-id']).toEqual(1);
      expect(graph.nodes[1].name).toEqual('destination');
      expect(graph.nodes[1]['stream-id']).toBeUndefined();
      expect(graph.nodes[2].name).toEqual('file');
      expect(graph.nodes[2]['stream-id']).toEqual(2);
      expect(graph.links.length).toEqual(2);
      expect(graph.links[0].from).toEqual(0);
      expect(graph.links[0].to).toEqual(1);
      expect(graph.links[1].from).toEqual(2);
      expect(graph.links[1].to).toEqual(1);
  });

  it('jsongraph: tapping a stream', () => {
    graph = getGraph('aaaa= time | log\n:aaaa.time>log');
    expect(graph.streamdefs[0].def).toEqual('time | log');
    expect(graph.streamdefs[0].name).toEqual('aaaa');
    expect(graph.streamdefs[1].def).toEqual(':aaaa.time > log');
    expect(graph.nodes[0].name).toEqual('time');
    expect(graph.nodes[0]['stream-name']).toEqual('aaaa');
    expect(graph.nodes[1].name).toEqual('log');
    expect(graph.nodes[1]['stream-id']).toBeUndefined();
    expect(graph.nodes[2].name).toEqual('log');
    expect(graph.nodes[2]['stream-id']).toEqual(2);
    expect(graph.links.length).toEqual(2);
    expect(graph.links[0].from).toEqual(0);
    expect(graph.links[0].to).toEqual(1);
    expect(graph.links[1].from).toEqual(0);
    expect(graph.links[1].to).toEqual(2);
    expect(graph.links[1].linkType).toEqual('tap');
});

  it('jsongraph: basic', () => {
    graph = getGraph('time | log');
    expect(graph.format).toEqual('scdf');
    expect(graph.errors).toBeUndefined();
    expect(graph.nodes.length).toEqual(2);
    expect(graph.links.length).toEqual(1);

    expect(graph.streamdefs[0].name).toEqual('');
    expect(graph.streamdefs[0].def).toEqual('time | log');

    node = graph.nodes[0];
    expect(node.id).toEqual(0);
    expect(node.name).toEqual('time');
    expect(node['stream-id']).toEqual(1);
    expectRange(node.range, 0, 0, 4, 0);

    node = graph.nodes[1];
    expect(node.id).toEqual(1);
    expect(node.name).toEqual('log');
    expect(node['stream-id']).toBeUndefined();
    expectRange(node.range, 7, 0, 10, 0);

    link = graph.links[0];
    expect(link.from).toEqual(0);
    expect(link.to).toEqual(1);
  });


  it('jsongraph: properties', () => {
    graph = getGraph('time --aaa=bbb --ccc=ddd | log');
    expect(graph.errors).toBeUndefined();
    expect(graph.nodes.length).toEqual(2);
    expect(graph.links.length).toEqual(1);

    expect(graph.streamdefs[0].name).toEqual('');
    expect(graph.streamdefs[0].def).toEqual('time --aaa=bbb --ccc=ddd | log');

    node = graph.nodes[0];
    expect(node.id).toEqual(0);
    expect(node.name).toEqual('time');
    expect(node['stream-id']).toEqual(1);
    expect(node.properties['aaa']).toEqual('bbb');
    expectRange(node.propertiesranges['aaa'], 5, 0, 14, 0);
    expect(node.properties['ccc']).toEqual('ddd');
    expectRange(node.propertiesranges['ccc'], 15, 0, 24, 0);
    expectRange(node.range, 0, 0, 4, 0);

    node = graph.nodes[1];
    expect(node.id).toEqual(1);
    expect(node.name).toEqual('log');
    expect(node['stream-id']).toBeUndefined();
    expectRange(node.range, 27, 0, 30, 0);

    link = graph.links[0];
    expect(link.from).toEqual(0);
    expect(link.to).toEqual(1);
  });

  it('jsongraph: source channel', () => {
    graph = getGraph(':abc > log');
    expect(graph.format).toEqual('scdf');
    expect(graph.errors).toBeUndefined();
    expect(graph.nodes.length).toEqual(2);
    expect(graph.links.length).toEqual(1);

    expect(graph.streamdefs[0].name).toEqual('');
    expect(graph.streamdefs[0].def).toEqual(':abc > log');

    node = graph.nodes[0];
    expect(node.id).toEqual(0);
    expect(node.name).toEqual('destination');
    expect(node.properties['name']).toEqual('abc');
    expect(node['stream-id']).toBeUndefined(); // destination source doesn't get an ID
//    expectRange(node.range,0,0,4,0); TODO missing range???

    node = graph.nodes[1];
    expect(node.id).toEqual(1);
    expect(node.name).toEqual('log');
    expect(node['stream-id']).toEqual(1);
    expectRange(node.range, 7, 0, 10, 0);

    link = graph.links[0];
    expect(link.from).toEqual(0);
    expect(link.to).toEqual(1);
  });

  it('jsongraph: sink channel', () => {
    graph = getGraph('time > :abc');
    expect(graph.format).toEqual('scdf');
    expect(graph.errors).toBeUndefined();
    expect(graph.nodes.length).toEqual(2);
    expect(graph.links.length).toEqual(1);

    expect(graph.streamdefs[0].name).toEqual('');
    expect(graph.streamdefs[0].def).toEqual('time  > :abc'); // TODO extra space?

    node = graph.nodes[0];
    expect(node.id).toEqual(0);
    expect(node.name).toEqual('time');
    expect(node['stream-id']).toEqual(1);
    expectRange(node.range, 0, 0, 4, 0);

    node = graph.nodes[1];
    expect(node.id).toEqual(1);
    expect(node.name).toEqual('destination');
    expect(node.properties['name']).toEqual('abc');
    expect(node['stream-id']).toBeUndefined();
//    expectRange(node.range,0,0,4,0); TODO missing range???

    link = graph.links[0];
    expect(link.from).toEqual(0);
    expect(link.to).toEqual(1);
  });

  function getGraph(dsl: string) {
    parseResult = Parser.parse(dsl, 'stream');
    return convertParseResponseToJsonGraph(dsl, parseResult).graph;
  }

  function expectRange(range: JsonGraph.Range, startChar: number, startLine: number, endChar: number, endLine: number) {
    expect(range.start.ch).toEqual(startChar);
    expect(range.start.line).toEqual(startLine);
    expect(range.end.ch).toEqual(endChar);
    expect(range.end.line).toEqual(endLine);
  }
});
