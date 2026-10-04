<?php

declare(strict_types=1);

namespace FootballAPI;

// Set strict error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Set response headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

class FootballAPI {
    private const JSON_FILE = 'combined_matches.json';
    private const DEFAULT_PAGE_SIZE = 100;
    private const MAX_PAGE_SIZE = 500; // Prevent excessive memory usage
    
    private array $matches = [];
    
    public function __construct() {
        $this->loadMatches();
    }
    
    /**
     * Load matches from JSON file
     * @throws \RuntimeException When file cannot be read
     */
    private function loadMatches(): void {
        if (!is_file(self::JSON_FILE)) {
            throw new \RuntimeException("JSON file not found: " . self::JSON_FILE);
        }

        $jsonData = file_get_contents(self::JSON_FILE);
        if ($jsonData === false) {
            throw new \RuntimeException("Failed to read JSON file: " . self::JSON_FILE);
        }

        try {
            $data = json_decode($jsonData, true, 512, JSON_THROW_ON_ERROR);
            $this->matches = $data['matches'] ?? [];
        } catch (\JsonException $e) {
            throw new \RuntimeException("Invalid JSON data: " . $e->getMessage());
        }
    }
    
    /**
     * Calculate percentage of matches where both teams scored
     */
    private function calculateBothTeamsScoredPercentage(array $matches): float {
        $matchCount = count($matches);
        if ($matchCount === 0) {
            return 0.0;
        }

        $bothTeamsScoredCount = array_reduce($matches, function(int $count, array $match): int {
            // Validate score structure before accessing
            if (!isset($match['score']['home']) || !isset($match['score']['away'])) {
                return $count;
            }
            return $count + (($match['score']['home'] > 0 && $match['score']['away'] > 0) ? 1 : 0);
        }, 0);

        return round(($bothTeamsScoredCount / $matchCount) * 100, 2);
    }
    
    /**
     * Calculate average goals statistics
     */
    private function calculateAverageGoals(array $matches): array {
        if (empty($matches)) {
            return [
                'average_total_goals' => 0.0,
                'average_home_goals' => 0.0,
                'average_away_goals' => 0.0
            ];
        }

        $totalMatches = count($matches);
        $goals = array_reduce($matches, function(array $acc, array $match): array {
            // Validate score structure before accessing
            $homeGoals = isset($match['score']['home']) ? (int)$match['score']['home'] : 0;
            $awayGoals = isset($match['score']['away']) ? (int)$match['score']['away'] : 0;
            
            return [
                'total' => $acc['total'] + $homeGoals + $awayGoals,
                'home' => $acc['home'] + $homeGoals,
                'away' => $acc['away'] + $awayGoals
            ];
        }, ['total' => 0, 'home' => 0, 'away' => 0]);

        return [
            'average_total_goals' => round($goals['total'] / $totalMatches, 2),
            'average_home_goals' => round($goals['home'] / $totalMatches, 2),
            'average_away_goals' => round($goals['away'] / $totalMatches, 2)
        ];
    }
    
    /**
     * Calculate team form index based on recent games
     */
    private function calculateFormIndex(array $matches, string $team, int $recentGames = 5): float {
        if (empty($team)) {
            return 0.0;
        }
        
        $teamMatches = array_values(array_filter($matches, function(array $match) use ($team): bool {
            return 
                (isset($match['home_team']) && strcasecmp($match['home_team'], $team) === 0) || 
                (isset($match['away_team']) && strcasecmp($match['away_team'], $team) === 0);
        }));

        if (empty($teamMatches)) {
            return 0.0;
        }

        $recentMatches = array_slice($teamMatches, 0, min(count($teamMatches), $recentGames));
        $points = array_reduce($recentMatches, function(int $sum, array $match) use ($team): int {
            // Validate required fields exist
            if (!isset($match['home_team']) || !isset($match['away_team']) || 
                !isset($match['score']['home']) || !isset($match['score']['away'])) {
                return $sum;
            }
            
            $isHomeTeam = strcasecmp($match['home_team'], $team) === 0;
            $homeScore = (int)$match['score']['home'];
            $awayScore = (int)$match['score']['away'];

            if ($isHomeTeam) {
                if ($homeScore > $awayScore) return $sum + 3;
                if ($homeScore === $awayScore) return $sum + 1;
            } else {
                if ($awayScore > $homeScore) return $sum + 3;
                if ($homeScore === $awayScore) return $sum + 1;
            }

            return $sum;
        }, 0);

        $maxPossiblePoints = count($recentMatches) * 3;
        return $maxPossiblePoints > 0 ? round(($points / $maxPossiblePoints) * 100, 2) : 0.0;
    }
    
    /**
     * Calculate head-to-head statistics between teams
     */
    private function calculateHeadToHeadStats(array $matches): array {
        if (empty($matches)) {
            return [
                'home_wins' => 0,
                'away_wins' => 0,
                'draws' => 0,
                'home_win_percentage' => 0.0,
                'away_win_percentage' => 0.0,
                'draw_percentage' => 0.0
            ];
        }

        // Filter out matches with invalid score structure
        $validMatches = array_filter($matches, function(array $match): bool {
            return isset($match['score']['home']) && isset($match['score']['away']);
        });
        
        $totalMatches = count($validMatches);
        if ($totalMatches === 0) {
            return [
                'home_wins' => 0,
                'away_wins' => 0,
                'draws' => 0,
                'home_win_percentage' => 0.0,
                'away_win_percentage' => 0.0,
                'draw_percentage' => 0.0
            ];
        }

        $stats = array_reduce($validMatches, function(array $acc, array $match): array {
            $homeScore = (int)$match['score']['home'];
            $awayScore = (int)$match['score']['away'];
            
            if ($homeScore > $awayScore) {
                $acc['home_wins']++;
            } elseif ($homeScore < $awayScore) {
                $acc['away_wins']++;
            } else {
                $acc['draws']++;
            }
            return $acc;
        }, ['home_wins' => 0, 'away_wins' => 0, 'draws' => 0]);

        return [
            'home_wins' => $stats['home_wins'],
            'away_wins' => $stats['away_wins'],
            'draws' => $stats['draws'],
            'home_win_percentage' => round(($stats['home_wins'] / $totalMatches) * 100, 2),
            'away_win_percentage' => round(($stats['away_wins'] / $totalMatches) * 100, 2),
            'draw_percentage' => round(($stats['draws'] / $totalMatches) * 100, 2)
        ];
    }
    
    /**
     * Filter matches based on query parameters
     */
    private function filterMatches(array $matches, array $params): array {
        if (empty($params)) {
            return $matches;
        }
        
        return array_filter($matches, function(array $match) use ($params): bool {
            foreach ($params as $key => $value) {
                if (!$this->matchParameter($match, $key, $value)) {
                    return false;
                }
            }
            return true;
        });
    }
    
    /**
     * Check if a match parameter matches the specified condition
     */
    private function matchParameter(array $match, string $key, string $value): bool {
        switch ($key) {
            case 'team':
                return $this->matchesTeam($match, $value);
            case 'home_team':
                return $this->matchesHomeTeam($match, $value);
            case 'away_team':
                return $this->matchesAwayTeam($match, $value);
            case 'date':
                return $this->matchesDate($match, $value);
            case (str_starts_with($key, 'score_')):
                return $this->matchesScore($match, $key, $value);
            case 'both_teams_scored':
                return $this->matchesBothTeamsScored($match, $value);
            default:
                return $this->matchesDefault($match, $key, $value);
        }
    }
    
    /**
     * Check if a team is involved in a match
     */
    private function matchesTeam(array $match, string $value): bool {
        if (!isset($match['home_team']) || !isset($match['away_team'])) {
            return false;
        }
        return strcasecmp($match['home_team'], $value) === 0 ||
               strcasecmp($match['away_team'], $value) === 0;
    }
    
    /**
     * Check if a team is the home team in a match
     */
    private function matchesHomeTeam(array $match, string $value): bool {
        return isset($match['home_team']) && strcasecmp($match['home_team'], $value) === 0;
    }
    
    /**
     * Check if a team is the away team in a match
     */
    private function matchesAwayTeam(array $match, string $value): bool {
        return isset($match['away_team']) && strcasecmp($match['away_team'], $value) === 0;
    }
    
    /**
     * Check if a match date matches the specified condition
     */
    private function matchesDate(array $match, string $value): bool {
        if (!isset($match['date'])) {
            return false;
        }
        
        try {
            $matchDate = new \DateTime($match['date']);
            $paramDate = new \DateTime($value);
            return $matchDate >= $paramDate;
        } catch (\Exception $e) {
            return false;
        }
    }
    
    /**
     * Check if a match score matches the specified condition
     */
    private function matchesScore(array $match, string $key, string $value): bool {
        $scoreType = str_replace('score_', '', $key);
        
        // Validate the score structure
        if (!isset($match['score']) || !is_array($match['score']) || !isset($match['score'][$scoreType])) {
            return false;
        }
        
        return (string)$match['score'][$scoreType] === $value;
    }
    
    /**
     * Check if both teams scored in a match
     */
    private function matchesBothTeamsScored(array $match, string $value): bool {
        // Validate the score structure
        if (!isset($match['score']['home']) || !isset($match['score']['away'])) {
            return false;
        }
        
        $bothScored = ((int)$match['score']['home'] > 0 && (int)$match['score']['away'] > 0);
        $expected = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        
        // Handle invalid boolean values
        if ($expected === null) {
            return false;
        }
        
        return $bothScored === $expected;
    }
    
    /**
     * Check if a match property matches the specified condition
     */
    private function matchesDefault(array $match, string $key, string $value): bool {
        return isset($match[$key]) && strcasecmp((string)$match[$key], $value) === 0;
    }
    
    /**
     * Get a list of all available teams
     */
    private function getAvailableTeams(array $matches): array {
        $teams = array_reduce($matches, function(array $acc, array $match): array {
            if (!empty($match['home_team'])) {
                $acc[] = $match['home_team'];
            }
            if (!empty($match['away_team'])) {
                $acc[] = $match['away_team'];
            }
            return $acc;
        }, []);
        
        // Case-insensitive unique values
        $uniqueTeams = [];
        foreach ($teams as $team) {
            $lowerTeam = strtolower($team);
            if (!isset($uniqueTeams[$lowerTeam])) {
                $uniqueTeams[$lowerTeam] = $team;
            }
        }
        
        return array_values($uniqueTeams);
    }
    
    /**
     * Calculate expected goals for a team
     */
    private function calculateExpectedGoals(string $team, array $matches): float {
        if (empty($team) || empty($matches)) {
            return 0.0;
        }

        $teamMatches = array_filter($matches, function(array $match) use ($team): bool {
            return 
                (isset($match['home_team']) && strcasecmp($match['home_team'], $team) === 0) || 
                (isset($match['away_team']) && strcasecmp($match['away_team'], $team) === 0);
        });

        if (empty($teamMatches)) {
            return 0.0;
        }

        // Filter out matches with invalid score structure
        $validMatches = array_filter($teamMatches, function(array $match) use ($team): bool {
            return isset($match['score']['home']) && isset($match['score']['away']);
        });
        
        if (empty($validMatches)) {
            return 0.0;
        }

        $totalGoals = array_reduce($validMatches, function(float $sum, array $match) use ($team): float {
            $isHomeTeam = strcasecmp($match['home_team'] ?? '', $team) === 0;
            return $sum + ($isHomeTeam ? 
                (float)$match['score']['home'] : (float)$match['score']['away']);
        }, 0.0);

        return round($totalGoals / count($validMatches), 2);
    }
    
    /**
     * Calculate probability of both teams to score
     */
    private function calculateBothTeamsToScoreProb(array $matches): float {
        if (empty($matches)) {
            return 0.0;
        }

        // Filter out matches with invalid score structure
        $validMatches = array_filter($matches, function(array $match): bool {
            return isset($match['score']['home']) && isset($match['score']['away']);
        });
        
        if (empty($validMatches)) {
            return 0.0;
        }

        $bothScoredCount = count(array_filter($validMatches, function(array $match): bool {
            return (int)$match['score']['home'] > 0 && (int)$match['score']['away'] > 0;
        }));

        return round(($bothScoredCount / count($validMatches)) * 100, 2);
    }
    
    /**
     * Predict winner based on historical head-to-head matches
     */
    private function predictWinner(string $homeTeam, string $awayTeam, array $matches): array {
        if (empty($homeTeam) || empty($awayTeam) || empty($matches)) {
            return ['winner' => 'unknown', 'confidence' => 0.0];
        }

        $h2hMatches = array_filter($matches, function(array $match) use ($homeTeam, $awayTeam): bool {
            return 
                isset($match['home_team']) && isset($match['away_team']) &&
                strcasecmp($match['home_team'], $homeTeam) === 0 && 
                strcasecmp($match['away_team'], $awayTeam) === 0;
        });

        // Filter out matches with invalid score structure
        $validMatches = array_filter($h2hMatches, function(array $match): bool {
            return isset($match['score']['home']) && isset($match['score']['away']);
        });

        if (empty($validMatches)) {
            return ['winner' => 'unknown', 'confidence' => 0.0];
        }

        $stats = array_reduce($validMatches, function(array $acc, array $match): array {
            $homeScore = (int)$match['score']['home'];
            $awayScore = (int)$match['score']['away'];
            
            if ($homeScore > $awayScore) {
                $acc['home_wins']++;
            } elseif ($homeScore < $awayScore) {
                $acc['away_wins']++;
            } else {
                $acc['draws']++;
            }
            return $acc;
        }, ['home_wins' => 0, 'away_wins' => 0, 'draws' => 0]);

        $totalMatches = count($validMatches);
        
        if ($stats['home_wins'] > $stats['away_wins'] && $stats['home_wins'] > $stats['draws']) {
            return ['winner' => 'home', 'confidence' => round($stats['home_wins'] / $totalMatches, 2)];
        } elseif ($stats['away_wins'] > $stats['home_wins'] && $stats['away_wins'] > $stats['draws']) {
            return ['winner' => 'away', 'confidence' => round($stats['away_wins'] / $totalMatches, 2)];
        } else {
            return ['winner' => 'draw', 'confidence' => round($stats['draws'] / $totalMatches, 2)];
        }
    }
    
    /**
     * Run match prediction analysis
     */
    private function runPrediction(string $homeTeam, string $awayTeam, array $matches): array {
        $homeExpectedGoals = $this->calculateExpectedGoals($homeTeam, $matches);
        $awayExpectedGoals = $this->calculateExpectedGoals($awayTeam, $matches);
        $bothTeamsToScoreProb = $this->calculateBothTeamsToScoreProb($matches);
        $winnerPrediction = $this->predictWinner($homeTeam, $awayTeam, $matches);

        return [
            'homeExpectedGoals' => $homeExpectedGoals,
            'awayExpectedGoals' => $awayExpectedGoals,
            'bothTeamsToScoreProb' => $bothTeamsToScoreProb,
            'predictedWinner' => $winnerPrediction['winner'],
            'confidence' => $winnerPrediction['confidence'],
            'modelPredictions' => [
                'randomForest' => $winnerPrediction['winner'] === 'unknown' ? 
                    'insufficient_data' : $winnerPrediction['winner'] . '_win',
                'poisson' => [
                    'homeGoals' => round($homeExpectedGoals),
                    'awayGoals' => round($awayExpectedGoals)
                ],
                'elo' => [
                    'homeWinProb' => $this->calculateWinProbability($winnerPrediction, 'home'),
                    'drawProb' => $this->calculateWinProbability($winnerPrediction, 'draw'),
                    'awayWinProb' => $this->calculateWinProbability($winnerPrediction, 'away')
                ]
            ]
        ];
    }
    
    /**
     * Calculate win probability based on winner prediction and outcome type
     */
    private function calculateWinProbability(array $winnerPrediction, string $outcomeType): float {
        if ($winnerPrediction['winner'] === 'unknown') {
            // Equal probability for all outcomes when unknown
            return round(1/3, 2);
        }
        
        if ($winnerPrediction['winner'] === $outcomeType) {
            return $winnerPrediction['confidence'];
        }
        
        // Distribute remaining probability among non-predicted outcomes
        $remainingProb = 1 - $winnerPrediction['confidence'];
        $nonPredictedOutcomes = 2; // There are always 2 other outcomes (home, away, draw)
        return round($remainingProb / $nonPredictedOutcomes, 2);
    }
    
    /**
     * Validate and sanitize input parameters
     */
    private function validateAndSanitizeParams(array $params): array {
        $sanitizedParams = [];
        
        foreach ($params as $key => $value) {
            // Skip empty values
            if ($value === '') {
                continue;
            }
            
            // Sanitize and validate based on parameter type
            switch ($key) {
                case 'page':
                case 'page_size':
                    $sanitizedParams[$key] = filter_var($value, FILTER_VALIDATE_INT) !== false ? 
                        (int)$value : null;
                    break;
                    
                case 'date':
                    // Validate date format
                    try {
                        new \DateTime($value);
                        $sanitizedParams[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
                    } catch (\Exception $e) {
                        // Invalid date, skip this parameter
                    }
                    break;
                    
                case 'both_teams_scored':
                    // Validate boolean value
                    if (in_array(strtolower($value), ['true', 'false', '1', '0'], true)) {
                        $sanitizedParams[$key] = strtolower($value);
                    }
                    break;
                    
                case (str_starts_with($key, 'score_')):
                    // Validate score values are numeric
                    if (is_numeric($value)) {
                        $sanitizedParams[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
                    }
                    break;
                    
                default:
                    // General string parameters
                    $sanitizedParams[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
                    break;
            }
        }
        
        return $sanitizedParams;
    }
    
    /**
     * Process API request and return response
     */
    public function processRequest(): array {
        try {
            // Sanitize and filter parameters
            $params = $this->validateAndSanitizeParams($_GET);
            
            // Filter matches based on parameters
            $filteredMatches = $this->filterMatches($this->matches, $params);

            // Sort matches by date descending
            usort($filteredMatches, function($a, $b) {
                $dateA = isset($a['date']) ? strtotime($a['date']) : 0;
                $dateB = isset($b['date']) ? strtotime($b['date']) : 0;
                return $dateB <=> $dateA;
            });

            // Pagination
            $page = isset($params['page']) ? max(1, (int)$params['page']) : 1;
            $pageSize = isset($params['page_size']) ? 
                min(max(1, (int)$params['page_size']), self::MAX_PAGE_SIZE) : 
                self::DEFAULT_PAGE_SIZE;
                
            $totalMatches = count($filteredMatches);
            $offset = ($page - 1) * $pageSize;
            $paginatedMatches = array_slice($filteredMatches, $offset, $pageSize);

            // Team analysis
            $homeTeam = $params['home_team'] ?? '';
            $awayTeam = $params['away_team'] ?? '';
            $teamAnalysis = null;
            $prediction = null;

            if (!empty($homeTeam) && !empty($awayTeam)) {
                $teamAnalysisMatches = array_filter($filteredMatches, function(array $match) use ($homeTeam, $awayTeam): bool {
                    return 
                        (isset($match['home_team']) && isset($match['away_team'])) &&
                        ((strcasecmp($match['home_team'], $homeTeam) === 0 &&
                         strcasecmp($match['away_team'], $awayTeam) === 0) ||
                        (strcasecmp($match['home_team'], $awayTeam) === 0 &&
                         strcasecmp($match['away_team'], $homeTeam) === 0));
                });

                $teamAnalysis = [
                    'home_team' => $homeTeam,
                    'away_team' => $awayTeam,
                    'matches_count' => count($teamAnalysisMatches),
                    'both_teams_scored_percentage' => $this->calculateBothTeamsScoredPercentage($teamAnalysisMatches),
                    'average_goals' => $this->calculateAverageGoals($teamAnalysisMatches),
                    'home_form_index' => $this->calculateFormIndex($filteredMatches, $homeTeam),
                    'away_form_index' => $this->calculateFormIndex($filteredMatches, $awayTeam),
                    'head_to_head_stats' => $this->calculateHeadToHeadStats($teamAnalysisMatches)
                ];

                $prediction = $this->runPrediction($homeTeam, $awayTeam, $filteredMatches);
            }

            return [
                'total_matches' => $totalMatches,
                'page' => $page,
                'page_size' => $pageSize,
                'matches' => array_values($paginatedMatches),
                'team_analysis' => $teamAnalysis,
                'prediction' => $prediction,
                'teams' => $this->getAvailableTeams($this->matches) // Add available teams list
            ];
        } catch (\Exception $e) {
            http_response_code(500);
            return [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ];
        }
    }
}

// Execute the API
try {
    $api = new FootballAPI();
    $response = $api->processRequest();
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'API execution error: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}