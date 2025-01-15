import React, { FC } from "react";
import {
  Card,
  CardBody,
  Flex,
  FlexItem,
  Label,
  Page,
  PageSection,
  Spinner,
  Title,
} from "@patternfly/react-core";
import IncidentList from "./IncidentList";
import { FileChanges } from "./FileChanges";
import { LocalChange } from "@editor-extensions/shared";
import { useExtensionState } from "../hooks/useExtensionState";
import { applyFile, discardFile, viewFix } from "../hooks/actions";

const ResolutionPage: React.FC = () => {
  const [state, dispatch] = useExtensionState();
  const {
    localChanges,
    isAnalyzing,
    isFetchingSolution,
    isStartingServer,
    solutionData: resolution,
    solutionScope,
    solutionMessages,
    solutionState,
  } = state;
  const getRemainingFiles = () => {
    if (!resolution) {
      return [];
    }
    return localChanges.filter(({ state }) => state === "pending");
  };
  const isTriggeredByUser = !!solutionScope?.incidents?.length;
  const isHistorySolution = !isTriggeredByUser && !!localChanges.length;

  const isResolved = localChanges.length !== 0 && getRemainingFiles().length === 0;
  const hasResponseWithErrors =
    solutionState === "received" && !!resolution?.encountered_errors?.length;
  const hasResponse =
    (solutionState === "received" || isHistorySolution) && localChanges.length > 0;
  const hasEmptyResponse = solutionState === "received" && localChanges.length === 0;
  const hasNothingToView = solutionState === "none" && localChanges.length === 0;

  const handleFileClick = (change: LocalChange) => dispatch(viewFix(change));

  const handleAcceptClick = (change: LocalChange) => dispatch(applyFile(change));

  const handleRejectClick = (change: LocalChange) => dispatch(discardFile(change));

  console.log("Resolution view state:", {
    isResolved,
    isTriggeredByUser,
    isHistorySolution,
    hasResponseWithErrors,
    hasResponse,
    hasEmptyResponse,
    hasNothingToView,
  });

  return (
    <Page>
      <PageSection className="pf-v5-u-px-xl pf-v5-u-py-md">
        <Flex>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              Kai Results
            </Title>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection className="pf-v5-u-px-xl pf-v5-u-py-md">
        <Flex
          direction={{
            default: "column",
          }}
        >
          {isTriggeredByUser && (
            <Flex
              direction={{
                default: "column",
              }}
              grow={{ default: "grow" }}
              alignItems={{ default: "alignItemsFlexEnd" }}
            >
              <FlexItem>
                <Label color="yellow">Here is the scope of what I would like you to fix:</Label>
              </FlexItem>
              <FlexItem>
                <IncidentList
                  incidents={solutionScope?.incidents ?? []}
                  selectedIncident={solutionScope?.incidents?.[0]}
                  onSelectIncident={() => {}}
                />
              </FlexItem>
              <FlexItem>
                <Label color="yellow">Please provide resolution for this issue.</Label>
              </FlexItem>
            </Flex>
          )}
          <Flex
            direction={{
              default: "column",
            }}
            grow={{ default: "grow" }}
            alignItems={{ default: "alignItemsFlexStart" }}
          >
            {hasNothingToView && (
              <FlexItem>
                <Label color="blue">No resolutions available.</Label>
              </FlexItem>
            )}
            {isHistorySolution && (
              <FlexItem>
                <Label color="blue">Loaded last known resolution.</Label>
              </FlexItem>
            )}
            {solutionMessages.map((msg) => (
              <FlexItem key={msg}>
                <Label color="blue">{msg}</Label>
              </FlexItem>
            ))}
            {isFetchingSolution && <Spinner />}

            {hasResponse && (
              <FlexItem>
                <Label color="blue">
                  <FileChanges
                    changes={getRemainingFiles()}
                    onFileClick={handleFileClick}
                    onApplyFix={handleAcceptClick}
                    onRejectChanges={handleRejectClick}
                  />
                </Label>
              </FlexItem>
            )}
            {hasEmptyResponse && !hasResponseWithErrors && (
              <FlexItem>
                <Label color="blue">Received response contains no resolutions.</Label>
              </FlexItem>
            )}

            {hasResponseWithErrors && (
              <>
                <FlexItem>
                  <Label color="blue">Response contains errors:</Label>
                </FlexItem>
                <FlexItem>
                  <ChatCard color="blue">
                    <ul>
                      {resolution.encountered_errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </ChatCard>
                </FlexItem>
              </>
            )}
            {isResolved && (
              <FlexItem>
                <Label color="blue">All resolutions have been applied.</Label>
              </FlexItem>
            )}
          </Flex>
        </Flex>
      </PageSection>
    </Page>
  );
};

const ChatCard: FC<{ color: "blue" | "yellow"; children: JSX.Element }> = ({ children, color }) => (
  <Card className={color === "blue" ? "pf-m-blue" : "pf-m-yellow"}>
    <CardBody>{children}</CardBody>
  </Card>
);

export default ResolutionPage;
